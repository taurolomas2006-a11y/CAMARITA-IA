"""Export the supplied SSD SavedModel, preserving its internal resize and NMS.

Conversion packages live in .tools/conversion-libs; TensorFlow comes from the
existing training environment. This script does not modify that environment.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools' / 'conversion-libs'))
os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, required=True)
    args = parser.parse_args()
    work = ROOT / '.tools' / 'source-model'
    work.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.archive) as archive:
        for entry in archive.infolist():
            target = (work / entry.filename).resolve()
            if not target.is_relative_to(work.resolve()):
                raise ValueError('Archive entry escapes the output directory')
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(entry))
    package = next(work.glob('*/selected_model.json')).parent
    descriptor = json.loads((package / 'selected_model.json').read_text(encoding='utf-8-sig'))
    import numpy as np
    import tensorflow as tf
    import tf2onnx
    import onnx
    import onnxruntime as ort
    from PIL import Image
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    loaded = tf.saved_model.load(str(package / 'saved_model'))
    signature = loaded.signatures['serving_default']
    inputs = signature.structured_input_signature[1]
    input_name, input_spec = next(iter(inputs.items()))
    if len(inputs) != 1 or input_spec.dtype != tf.uint8 or input_spec.shape.rank != 4:
        raise ValueError(f'Unexpected input: {inputs}')
    output_names = ['detection_boxes', 'detection_scores', 'detection_classes', 'num_detections']
    input_signature = [tf.TensorSpec([1, None, None, 3], tf.uint8, name='image')]

    @tf.function(input_signature=input_signature)
    def detector(image):
        values = signature(**{input_name: image})
        return tuple(values[name] for name in output_names)

    destination = ROOT / 'public' / 'models' / 'ssd-todo-50ep-v1'
    destination.mkdir(parents=True, exist_ok=True)
    print('Converting the complete SSD graph to ONNX (including resize and NMS)...', flush=True)
    # The SavedModel captures SSD anchor constants as eager tensors. tf2onnx's
    # from_function treats those as extra inputs; embed them in the frozen graph.
    from tensorflow.python.framework.convert_to_constants import convert_variables_to_constants_v2
    concrete = detector.get_concrete_function()
    frozen = convert_variables_to_constants_v2(concrete, lower_control_flow=False)
    graph = frozen.graph.as_graph_def(add_shapes=True)
    captured = dict(zip([tensor.name.split(':')[0] for tensor in concrete.inputs[-len(concrete.captured_inputs):]], concrete.captured_inputs))
    for node in graph.node:
        external = captured.get(node.name)
        if node.op == 'Placeholder' and external is not None and external.dtype != tf.resource:
            value = tf.make_tensor_proto(external.numpy(), dtype=external.dtype)
            node.op = 'Const'
            node.ClearField('attr')
            node.attr['dtype'].type = value.dtype
            node.attr['value'].tensor.CopyFrom(value)
    proto, _ = tf2onnx.convert.from_graph_def(graph, input_names=['image:0'],
        output_names=[tensor.name for tensor in frozen.outputs], opset=17, output_path=str(destination / 'model.onnx'))
    onnx.checker.check_model(proto)
    session = ort.InferenceSession(str(destination / 'model.onnx'), providers=['CPUExecutionProvider'])
    output_mapping = dict(zip(output_names, [output.name for output in session.get_outputs()]))
    image = np.asarray(Image.open(package / 'ejemplos' / 'entrada.jpeg').convert('RGB'))[None]
    expected = signature(**{input_name: tf.convert_to_tensor(image, tf.uint8)})
    actual = dict(zip(output_names, session.run(None, {session.get_inputs()[0].name: image})))
    errors = {}
    for name in output_names:
        reference = expected[name].numpy()
        errors[name] = float(np.max(np.abs(reference - actual[name])))
        if not np.allclose(reference, actual[name], atol=0.001, rtol=0.001):
            raise ValueError(f'Conversion mismatch for {name}: max error {errors[name]}')
    metadata = {
        'id': destination.name, 'name': 'SSD bebidas · TODO 50 épocas', 'version': '1.0.1',
        'format': 'onnx', 'runtime': 'onnx-ssd', 'file': 'model.onnx',
        'labels': descriptor['classes'], 'confidenceThreshold': descriptor['score_threshold'],
        'input': {'name': session.get_inputs()[0].name, 'type': 'uint8', 'layout': 'NHWC', 'shape': [1, -1, -1, 3]},
        'outputs': output_mapping, 'classIdOffset': 1, 'boxFormat': 'yxyx-normalized', 'duplicateIouThreshold': 0.85,
        'preprocessing': 'original-rgb-uint8', 'nms': 'included', 'experimental': True,
        'sourceModelId': descriptor['model_id'], 'architecture': descriptor['architecture'],
    }
    (destination / 'model.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    report = {'sourceArchiveSha256': hashlib.sha256(args.archive.read_bytes()).hexdigest(),
              'sourceModel': descriptor['model_id'], 'versions': {'tensorflow': tf.__version__, 'tf2onnx': tf2onnx.__version__, 'onnx': onnx.__version__, 'onnxruntime': ort.__version__},
              'originalInput': str(input_spec), 'onnxInput': str(session.get_inputs()[0].shape),
              'maxAbsoluteErrors': errors, 'originalCount': int(expected['num_detections'][0]),
              'sampleSize': list(image.shape), 'cpuParity': 'passed', 'cameraTest': 'pending-camera-off'}
    report_dir = ROOT / 'docs'
    report_dir.mkdir(exist_ok=True)
    (report_dir / 'model-conversion.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    fixture = ROOT / 'tests' / 'fixtures'
    fixture.mkdir(parents=True, exist_ok=True)
    Image.fromarray(image[0]).save(fixture / 'ssd-reference.png')
    (fixture / 'ssd-reference.json').write_text(json.dumps({name: expected[name].numpy().tolist() for name in output_names}), encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
