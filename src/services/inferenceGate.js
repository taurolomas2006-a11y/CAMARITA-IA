// One running inference per engine, including across scheduler restarts.
// A busy engine drops and closes the new capture instead of queuing it.
export function createInferenceGate(run) {
  let busy = false;
  return async (input) => {
    if (busy) { input.close(); return null; }
    busy = true;
    try { return await run(input); }
    finally { busy = false; }
  };
}
