```javascript
import * as pdfjsLib from
"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";


pdfjsLib.GlobalWorkerOptions.workerSrc =
"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";


const input =
document.getElementById("pdfInput");


const drop =
document.getElementById("dropzone");


const analyze =
document.getElementById("analyzeBtn");


const clear =
document.getElementById("clearBtn");


const fileName =
document.getElementById("fileName");


const progressWrap =
document.getElementById("progressWrap");


const progressBar =
document.getElementById("progressBar");


const progressText =
document.getElementById("progressText");


const progressPct =
document.getElementById("progressPct");


let selectedFile = null;



input.addEventListener(
"change",
() => {

  setFile(input.files[0]);

});



["dragenter","dragover"].forEach(
event => {

  drop.addEventListener(
    event,
    e => {

      e.preventDefault();

      drop.classList.add("drag");

    }
  );

});



["dragleave","drop"].forEach(
event => {

  drop.addEventListener(
    event,
    e => {

      e.preventDefault();

      drop.classList.remove("drag");

    }
  );

});



drop.addEventListener(
"drop",
e => {

  const file =
    e.dataTransfer.files[0];

  if (file) {

    setFile(file);

  }

});



function setFile(file) {

  if (
    !file ||
    file.type !== "application/pdf"
  ) {

    alert(
      "Elegí un archivo PDF."
    );

    return;

  }


  selectedFile = file;


  fileName.textContent =
    `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;


  analyze.disabled = false;

}



clear.addEventListener(
"click",
() => {

  selectedFile = null;

  input.value = "";

  fileName.textContent =
    "Ningún archivo seleccionado";

  analyze.disabled = true;

  document
    .getElementById("results")
    .classList
    .add("hidden");

  progressWrap
    .classList
    .add("hidden");

});



analyze.addEventListener(
"click",
async () => {

  if (!selectedFile) return;


  analyze.disabled = true;

  progressWrap
    .classList
    .remove("hidden");


  setProgress(
    5,
    "Abriendo el grimorio..."
  );


  try {

    const buffer =
      await selectedFile.arrayBuffer();


    const pdf =
      await pdfjsLib
        .getDocument({
          data: buffer
        })
        .promise;


    let text = "";


    const pages =
      pdf.numPages;


    for (
      let i = 1;
      i <= pages;
      i++
    ) {

      setProgress(
        10 +
        Math.round(
          i / pages * 70
        ),

        `Leyendo página ${i} de ${pages}...`
      );


      const page =
        await pdf.getPage(i);


      const content =
        await page.getTextContent();


      text +=
        content.items
          .map(item => item.str)
          .join(" ") +
        "\n";

    }


    setProgress(
      85,
      "Buscando fecha, importes y datos clave..."
    );


    const data =
      analyzeText(text);


    let attachments = [];


    try {

      const embedded =
        await pdf.getAttachments();


      if (embedded) {

        attachments =
          Object.keys(embedded);

      }

    } catch (error) {

      console.log(
        "No se pudieron consultar adjuntos.",
        error
      );

    }


    render(
      data,
      text,
      pages,
      attachments
    );


    setProgress(
      100,
      "Análisis terminado."
    );


  } catch (error) {

    console.error(error);


    alert(
      "No pude leer este PDF. Si es un PDF escaneado como imagen, necesitaremos OCR en una siguiente versión."
    );


  } finally {

    analyze.disabled = false;

  }

});



function setProgress(
  percentage,
  message
) {

  progressBar.style.width =
    percentage + "%";


  progressPct.textContent =
    percentage + "%";


  progressText.textContent =
    message;

}



function analyzeText(text) {

  const clean =
    text
      .replace(/\s+/g, " ")
      .trim();


  const datePatterns = [

    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/g,

    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(20\d{2})\b/gi

  ];


  let dates = [];


  for (
    const pattern of datePatterns
  ) {

    let match;


    while (
      (match =
        pattern.exec(clean)) &&
      dates.length < 30
    ) {

      dates.push(match[0]);

    }

  }


  dates =
    [...new Set(dates)];


  const moneyRegex =
    /(?:\$|ARS\s*)\s*[\d\.\,]+(?:\s*(?:pesos|ARS))?/gi;


  let money =
    [...clean.matchAll(moneyRegex)]
      .map(match => match[0])
      .slice(0, 30);


  const date =
    pickDate(
      clean,
      dates
    );


  const amount =
    pickAmount(
      clean,
      money
    );


  const key =
    extractKeys(clean);


  const summary =
    makeSummary(
      clean,
      key,
      date,
      amount
    );


  return {

    date,

    amount,

    key,

    summary

  };

}



function pickDate(
  text,
  dates
) {

  const words = [

    "evento",

    "eventos",

    "prestación",

    "prestacion",

    "servicio",

    "acto",

    "jornada",

    "realización",

    "realizacion",

    "fecha"

  ];


  for (
    const date of dates
  ) {

    const index =
      text
        .toLowerCase()
        .indexOf(
          date.toLowerCase()
        );


    const around =
      text.slice(
        Math.max(
          0,
          index - 100
        ),

        index + 140
      )
      .toLowerCase();


    if (
      words.some(
        word =>
          around.includes(word)
      )
    ) {

      return date;

    }

  }


  return dates[0] ||
    "No detectada";

}



function pickAmount(
  text,
  money
) {

  const cues = [

    "total",

    "importe",

    "monto",

    "valor",

    "presupuesto",

    "orden de compra",

    "total general",

    "precio"

  ];


  for (
    const amount of money
  ) {

    const index =
      text.indexOf(amount);


    const around =
      text.slice(
        Math.max(
          0,
          index - 80
        ),

        index + 60
      )
      .toLowerCase();


    if (
      cues.some(
        cue =>
          around.includes(cue)
      )
    ) {

      return amount;

    }

  }


  return money[0] ||
    "No detectado";

}



function extractKeys(text) {

  const find = labels => {

    for (
      const label of labels
    ) {

      const regex =
        new RegExp(
          label +
          "\\s*[:\\-]?\\s*([^.;]{3,100})",
          "i"
        );


      const match =
        text.match(regex);


      if (match) {

        return match[1].trim();

      }

    }


    return null;

  };


  return {

    expediente:
      find([
        "expediente",
        "EX-20"
      ]) ||
      "No detectado",


    proveedor:
      find([
        "proveedor",
        "razón social",
        "razon social"
      ]) ||
      "No detectado",


    objeto:
      find([
        "objeto",
        "concepto",
        "detalle",
        "descripción",
        "descripcion"
      ]) ||
      "No detectado"

  };

}



function makeSummary(
  text,
  key,
  date,
  amount
) {

  if (
    text.length < 80
  ) {

    return (
      "No se encontró suficiente texto. " +
      "Puede tratarse de un PDF escaneado como imagen."
    );

  }


  let summary =
    `El documento contiene información administrativa relacionada con ${
      key.objeto !== "No detectado"
        ? key.objeto
        : "una contratación o trámite"
    }.`;


  if (
    key.proveedor !==
    "No detectado"
  ) {

    summary +=
      ` El proveedor identificado es ${key.proveedor}.`;

  }


  if (
    date !==
    "No detectada"
  ) {

    summary +=
      ` Se detectó como fecha relevante ${date}.`;

  }


  if (
    amount !==
    "No detectado"
  ) {

    summary +=
      ` El importe identificado es ${amount}.`;

  }


  summary +=
    " El análisis se basa en el texto extraído automáticamente y conviene verificar los datos contra el documento original.";


  return summary;

}



function render(
  data,
  text,
  pages,
  attachments
) {

  document
    .getElementById("results")
    .classList
    .remove("hidden");


  document
    .getElementById("dateResult")
    .textContent =
      data.date;


  document
    .getElementById("moneyResult")
    .textContent =
      data.amount;


  document
    .getElementById("pagesResult")
    .textContent =
      pages;


  document
    .getElementById("dateConfidence")
    .textContent =
      data.date ===
      "No detectada"

        ? "Revisión manual necesaria"

        : "Detectada por contexto";


  document
    .getElementById("moneyConfidence")
    .textContent =
      data.amount ===
      "No detectado"

        ? "Revisión manual necesaria"

        : "Detectado por contexto";


  document
    .getElementById("summary")
    .textContent =
      data.summary;


  document
    .getElementById("keyData")
    .innerHTML =

      Object
        .entries(data.key)
        .map(
          ([key, value]) => {

            const labels = {

              expediente:
                "Expediente",

              proveedor:
                "Proveedor",

              objeto:
                "Objeto"

            };


            return `

              <div class="keyrow">

                <span>
                  ${labels[key]}
                </span>

                <b>
                  ${escapeHtml(value)}
                </b>

              </div>

            `;

          }
        )
        .join("");


  document
    .getElementById("rawText")
    .textContent =
      text;


  const attachmentBox =
    document
      .getElementById(
        "attachments"
      );


  if (
    attachments.length
  ) {

    attachmentBox.className =
      "attachments";


    attachmentBox.innerHTML =
      attachments
        .map(
          file => `

            <div class="attach">

              📎
              ${escapeHtml(file)}

            </div>

          `
        )
        .join("");

  } else {

    attachmentBox.className =
      "attachments empty";


    attachmentBox.textContent =
      "No se detectaron archivos embebidos en el PDF.";

  }


  document
    .getElementById("results")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

}



function escapeHtml(value) {

  return String(value)
    .replace(
      /[&<>"']/g,
      character => ({

        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        '"':
          "&quot;",

        "'":
          "&#39;"

      })[character]
    );

}
```

