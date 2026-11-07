// The trigger is independent of camera and runtime; a future light sensor can
// replace this scheduler without changing inventory semantics.
export function startContinuousDetection({ capture, infer, onResult, onError, onMetrics, isVisible = () => !document.hidden }) {
  let stopped = false;
  let timer;
  let lastSequence = -1;
  let previousResultAt = null;
  const tick = async () => {
    const started = performance.now();
    try {
      if (isVisible()) {
        const frame = await capture();
        if (frame) {
          if (stopped || frame.sequence === lastSequence) frame.bitmap.close();
          else {
            const result = await infer(frame.bitmap);
            if (!stopped && result) {
              lastSequence = frame.sequence;
              onResult(result.detections);
              const resultAt = performance.now();
              onMetrics({ durationMs: result.durationMs, fps: previousResultAt === null ? null : 1000 / (resultAt - previousResultAt) });
              previousResultAt = resultAt;
            }
          }
        }
      }
    } catch (error) {
      if (!stopped) {
        stopped = true;
        // An old engine can be disposed before React cleans up its scheduler.
        // That cancellation must never fail a newly loading model.
        if (error.name !== 'AbortError') onError(error);
      }
    }
    if (!stopped) timer = setTimeout(tick, Math.max(50, 200 - (performance.now() - started)));
  };
  tick();
  return () => { stopped = true; clearTimeout(timer); };
}
