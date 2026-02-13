/**
 * @param {ArrayBuffer} buffer
 * @param {string} name
 * @returns {FileList}
 */
const toFileList = (buffer, name) => {
  if (!name) {
    // This name should not be changed.
    name = 'Untitled';
  }

  const file = new File([buffer], name);
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  return dataTransfer.files;
};

const importFromParent = ({
  origin,
  onStartImporting,
  onFinishImporting,
  onCancelImporting
}) => {
  if (!origin.startsWith('http:') && !origin.startsWith('https:')) {
    console.warn('Import ignored: invalid origin');
    return;
  }

  const opener = window.opener || window.parent;
  if (!opener || opener === window) {
    console.warn('Import ignored: cannot find parent window or opener');
    return;
  }

  const postToParent = (data) => {
    // postMessage could throw if origin is invalid
    try {
      opener.postMessage({
        p4: data
      }, origin);
    } catch (e) {
      console.warn('Cannot post message', e);
    }
  };

  let hasStarted = false;
  let hasFinishedOrCancelled = false;

  const onMessage = (e) => {
    if (e.origin !== origin) {
      return;
    }

    const data = e.data && e.data.p4;
    if (!data) {
      return;
    }

    if (!hasStarted) {
      if (data.type === 'start-import') {
        hasStarted = true;
        onStartImporting();
      }
    } else if (!hasFinishedOrCancelled) {
      if (data.type === 'finish-import') {
        cleanup();

        onFinishImporting(toFileList(data.data, data.name));
      } else if (data.type === 'cancel-import') {
        cleanup();
        onCancelImporting();
      }
    }
  };
  window.addEventListener('message', onMessage);

  const cleanup = () => {
    hasFinishedOrCancelled = true;
    window.removeEventListener('message', onMessage);
  };

  postToParent({
    type: 'ready-for-import'
  });
};

const importFromTauri = ({
  onStartImporting,
  onFinishImporting,
  onCancelImporting
}) => {
  const current = window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
  const postMessage = (name, data) => current.emitTo('main', name, data);

  let hasStarted = false;
  let hasFinishedOrCancelled = false;

  const unlisten = current.listen('import', (event) => {
    const payload = event.payload;
    if (!payload) {
      return;
    }

    if (!hasStarted) {
      if (payload.type === 'start-import') {
        hasStarted = true;
        onStartImporting();
      }
    } else if (!hasFinishedOrCancelled) {
      if (payload.type === 'finish-import') {
        cleanup();

        onFinishImporting(toFileList(new Uint8Array(payload.data).buffer, payload.name));
      } else if (payload.type === 'cancel-import') {
        cleanup();
        onCancelImporting();
      }
    }
  });

  const cleanup = () => {
    hasFinishedOrCancelled = true;
    (async () => (await unlisten)())(); // unlisten is a promise
  };

  postMessage('ready-for-import');
}

const importFromAPI = async ({
  onStartImporting,
  onFinishImporting,
  onCancelImporting
}) => {
  try {
    onStartImporting();
    const {data, name} = await GlobalPackagerImporter();
    onFinishImporting(toFileList(data, name));
  } catch (e) {
    onCancelImporting();
  }
};

const importProject = ({
  onStartImporting,
  onFinishImporting,
  onCancelImporting
}) => {
  if (typeof GlobalPackagerImporter === 'function') {
    importFromAPI({
      onStartImporting,
      onFinishImporting,
      onCancelImporting
    });
    return;
  }

  const searchParams = new URLSearchParams(location.search);
  if (searchParams.has('import_from')) {
    importFromParent({
      origin: searchParams.get('import_from'),
      onStartImporting,
      onFinishImporting,
      onCancelImporting
    });
    return;
  }
  if (searchParams.has('import_from_tauri')) {
    importFromTauri({
      onStartImporting,
      onFinishImporting,
      onCancelImporting
    });
  }
};

export default importProject;
