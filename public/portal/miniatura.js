// Portal AW-RiseCR · vista previa de un PDF (solo en el panel de Andrew)
// Al publicar un reporte, el navegador dibuja la primera página con PDF.js y la sube como imagen junto al PDF:
// el cliente ve la miniatura sin descargar el PDF ni cargar PDF.js.
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/";
const ANCHO = 640; // px de la imagen: se ve a unos 260 px, nítida en pantallas retina

let pdfjs = null;
async function cargar() {
  if (!pdfjs) {
    // El trabajo de PDF.js corre en la misma página: la política de seguridad no admite workers de otro dominio
    globalThis.pdfjsWorker ??= await import(PDFJS + "pdf.worker.min.mjs");
    pdfjs = await import(PDFJS + "pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
  }
  return pdfjs;
}

const exportar = (lienzo, tipo, calidad) => new Promise((listo) => lienzo.toBlob(listo, tipo, calidad));

// Imagen (WebP, o JPEG en Safari, que no exporta WebP) de la primera página del PDF
export async function miniaturaPdf(pdf) {
  const { getDocument } = await cargar();
  const tarea = getDocument({ data: new Uint8Array(await pdf.arrayBuffer()), isEvalSupported: false, verbosity: 0 });
  try {
    const pagina = await (await tarea.promise).getPage(1);
    const vista = pagina.getViewport({ scale: ANCHO / pagina.getViewport({ scale: 1 }).width });
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(vista.width);
    lienzo.height = Math.round(vista.height);
    await pagina.render({ canvas: lienzo, viewport: vista }).promise;
    const webp = await exportar(lienzo, "image/webp", 0.82);
    return webp?.type === "image/webp" ? webp : await exportar(lienzo, "image/jpeg", 0.86);
  } finally {
    await tarea.destroy();
  }
}
