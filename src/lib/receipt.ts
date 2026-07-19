import type { Order } from "@/lib/types";
import { formatFCFA } from "@/lib/data";
import { orderCode } from "@/lib/order-code";

const DIEGO_ADDRESS = [
  "+225 01 00 11 11 92",
  "www.chezdiego.ci",
  "Abatta Carrefour BCEAO",
  "Abidjan, Côte d'Ivoire",
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paymentLabel(order: Order): string {
  if (order.paymentMethod === "especes") return "Espèces";
  if (order.paymentMethod === "mobile_money") return "Mobile Money";
  if (order.paymentMethod === "carte") return "Carte";
  return "Non renseigné";
}

export function printOrderReceipt(order: Order): void {
  const code = orderCode(order.number, order.createdAt);
  const receiptWindow = window.open("", "_blank", "width=420,height=720");
  if (!receiptWindow) {
    throw new Error("Autorisez les fenêtres pop-up pour imprimer le reçu.");
  }

  const itemRows = order.lines
    .map(
      ({ product, qty }) => `
        <tr>
          <td>${qty} × ${escapeHtml(product.name)}</td>
          <td>${escapeHtml(formatFCFA(product.price * qty))}</td>
        </tr>`
    )
    .join("");

  const context =
    order.channel === "livraison"
      ? "Livraison"
      : order.table
        ? escapeHtml(order.table)
        : "Au resto";

  receiptWindow.document.write(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Facture Diego #${code}</title>
    <style>
      @page { size: 80mm auto; margin: 3mm; }
      * { box-sizing: border-box; }
      html, body { width: 74mm; margin: 0; padding: 0; }
      body {
        color: #000;
        background: #fff;
        font-family: Arial, sans-serif;
        font-size: 10px;
        line-height: 1.35;
      }
      .center { text-align: center; }
      .logo { display: block; max-width: 30mm; max-height: 20mm; margin: 0 auto 2mm; object-fit: contain; }
      h1 { margin: 0 0 1mm; font-size: 17px; letter-spacing: 1px; }
      p { margin: .5mm 0; }
      .rule { border-top: 1px dashed #000; margin: 3mm 0; }
      .meta { display: flex; justify-content: space-between; gap: 2mm; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 1.2mm 0; vertical-align: top; }
      td:last-child { text-align: right; white-space: nowrap; }
      .total { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; }
      .note { margin-top: 2mm; overflow-wrap: anywhere; }
      .thanks { margin-top: 4mm; font-weight: 700; }
      @media screen {
        body { margin: 12px auto; box-shadow: 0 0 20px #ddd; padding: 3mm; }
      }
    </style>
  </head>
  <body>
    <header class="center">
      <img class="logo" src="${window.location.origin}/diego.png" alt="Diego" onerror="this.style.display='none'" />
      <h1>DIEGO</h1>
      ${DIEGO_ADDRESS.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    </header>
    <div class="rule"></div>
    <div class="meta"><strong>Facture #${code}</strong><span>${escapeHtml(context)}</span></div>
    <div class="meta"><span>${escapeHtml(new Date(order.createdAt).toLocaleString("fr-FR"))}</span><span>${escapeHtml(paymentLabel(order))}</span></div>
    ${order.note ? `<p class="note">${escapeHtml(order.note)}</p>` : ""}
    <div class="rule"></div>
    <table><tbody>${itemRows}</tbody></table>
    <div class="rule"></div>
    <div class="total"><span>TOTAL</span><span>${escapeHtml(formatFCFA(order.total))}</span></div>
    <p class="center thanks">Merci et à bientôt chez Diego !</p>
    <script>
      window.addEventListener("load", function () {
        setTimeout(function () { window.print(); }, 150);
      });
    </script>
  </body>
</html>`);
  receiptWindow.document.close();
}
