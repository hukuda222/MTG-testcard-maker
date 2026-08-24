// 複数カード画像をA4のPDFに敷き詰める処理(jsPDFのラッパー)
window.CardMaker = window.CardMaker || {};

(function () {
  "use strict";

  var A4_WIDTH_MM = 210;
  var A4_HEIGHT_MM = 297;
  var DEFAULT_CARD_WIDTH_MM = 63;
  var DEFAULT_CARD_HEIGHT_MM = 88;

  /** 指定したカードサイズでA4用紙1枚あたりに何列×何行、計何枚配置できるかを計算する */
  function computeGrid(cardWidthMm, cardHeightMm) {
    var cardW = cardWidthMm || DEFAULT_CARD_WIDTH_MM;
    var cardH = cardHeightMm || DEFAULT_CARD_HEIGHT_MM;
    var cols = Math.max(1, Math.floor(A4_WIDTH_MM / cardW));
    var rows = Math.max(1, Math.floor(A4_HEIGHT_MM / cardH));
    return { cols: cols, rows: rows, perPage: cols * rows };
  }

  /**
   * カードのPNG dataURL配列を受け取り、A4用紙に敷き詰めたjsPDFドキュメントを返す
   * (保存はしない)。カードサイズに応じて何列×何行入るかを自動計算し、中央寄せする。
   */
  function buildCardsPdf(dataUrls, options) {
    options = options || {};
    var cardW = options.cardWidthMm || DEFAULT_CARD_WIDTH_MM;
    var cardH = options.cardHeightMm || DEFAULT_CARD_HEIGHT_MM;

    var grid = computeGrid(cardW, cardH);
    var cols = grid.cols;
    var rows = grid.rows;
    var perPage = grid.perPage;
    var marginX = (A4_WIDTH_MM - cols * cardW) / 2;
    var marginY = (A4_HEIGHT_MM - rows * cardH) / 2;

    var JsPdfCtor = window.jspdf && window.jspdf.jsPDF;
    if (!JsPdfCtor) {
      throw new Error("jsPDFが読み込まれていません");
    }

    var doc = new JsPdfCtor({ unit: "mm", format: "a4", orientation: "portrait" });

    dataUrls.forEach(function (dataUrl, i) {
      var posInPage = i % perPage;
      if (i > 0 && posInPage === 0) doc.addPage();

      var col = posInPage % cols;
      var row = Math.floor(posInPage / cols);
      var x = marginX + col * cardW;
      var y = marginY + row * cardH;

      doc.addImage(dataUrl, "PNG", x, y, cardW, cardH, undefined, "FAST");
      doc.setDrawColor(180);
      doc.setLineWidth(0.15);
      doc.rect(x, y, cardW, cardH);
    });

    return doc;
  }

  window.CardMaker.pdfUtils = {
    A4_WIDTH_MM: A4_WIDTH_MM,
    A4_HEIGHT_MM: A4_HEIGHT_MM,
    DEFAULT_CARD_WIDTH_MM: DEFAULT_CARD_WIDTH_MM,
    DEFAULT_CARD_HEIGHT_MM: DEFAULT_CARD_HEIGHT_MM,
    computeGrid: computeGrid,
    buildCardsPdf: buildCardsPdf
  };
})();
