const downloadURL = (filename, url) => {
  if (window.showSaveFilePicker) {
    (async () => {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename
      });

      const res = await fetch(url);
      if (!res.ok) {
        alert(`Failed to fetch (Code: ${res.status}): ${res.statusText}`);
        return;
      }

      const blob = await res.blob();
      const writable = await handle.createWritable();
      await writable.write({ type: "truncate", size: 0 });
      await writable.write({ type: "write", position: 0, data: blob });
      await writable.close();
    })();
  } else {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();

    alert('The file should appear in your downloads folder!');
  }
};

export default downloadURL;
