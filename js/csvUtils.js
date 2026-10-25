// CSVの読み込み・書き出し(カード一括インポート用)
window.CardMaker = window.CardMaker || {};

(function () {
  "use strict";

  var VALID_CARD_TYPES = [
    "伝説",
    "同族",
    "エンチャント",
    "アーティファクト",
    "インスタント",
    "ソーサリー",
    "土地",
    "プレインズウォーカー",
    "クリーチャー",
    "英雄譚",
    "バトル"
  ];

  var HEADER_MAP = {};
  function addAliases(canonical, aliases) {
    aliases.forEach(function (alias) {
      HEADER_MAP[alias] = canonical;
    });
  }
  addAliases("name", ["name", "カード名", "名前"]);
  addAliases("manaCost", ["manacost", "マナコスト"]);
  addAliases("cardType", ["cardtype", "カードタイプ"]);
  addAliases("typeSubtype", ["typesubtype", "subtype", "サブタイプ", "その他のタイプ", "タイプその他"]);
  addAliases("power", ["power", "パワー"]);
  addAliases("toughness", ["toughness", "タフネス"]);
  addAliases("loyalty", ["loyalty", "忠誠度"]);
  addAliases("defense", ["defense", "守備値"]);
  addAliases("rulesText", ["rulestext", "rules", "ルールテキスト"]);
  addAliases("flavorText", ["flavortext", "flavor", "フレイバーテキスト", "フレイバー"]);
  addAliases("copies", ["copies", "count", "枚数", "印刷枚数"]);
  addAliases("artSource", ["image", "art", "画像", "イラスト"]);

  function normalizeHeader(h) {
    var t = String(h || "").trim();
    if (!t) return null;
    var asciiKey = t.toLowerCase().replace(/[\s_]+/g, "");
    if (HEADER_MAP[asciiKey]) return HEADER_MAP[asciiKey];
    if (HEADER_MAP[t]) return HEADER_MAP[t];
    return null;
  }

  /**
   * RFC4180風のCSVテキストを行×列の文字列配列にパースする。
   * ダブルクォートで囲まれたフィールド内のカンマ・改行・エスケープされた""に対応する。
   */
  function parseCSV(text) {
    var input = String(text || "");
    if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

    // base64画像を含む巨大なフィールドもあるため、1文字ずつ連結せずsliceで切り出す
    var rows = [];
    var row = [];
    var i = 0;
    var len = input.length;

    while (i < len) {
      var field;
      if (input[i] === '"') {
        var parts = [];
        var start = i + 1;
        while (true) {
          var q = input.indexOf('"', start);
          if (q === -1) {
            parts.push(input.slice(start));
            i = len;
            break;
          }
          parts.push(input.slice(start, q));
          if (input[q + 1] === '"') {
            parts.push('"');
            start = q + 2;
          } else {
            i = q + 1;
            break;
          }
        }
        field = parts.join("");
        // 閉じクォートの後ろに区切り以外の文字があれば、そのままフィールドに含める
        var tailEnd = i;
        while (tailEnd < len && input[tailEnd] !== "," && input[tailEnd] !== "\r" && input[tailEnd] !== "\n") tailEnd++;
        field += input.slice(i, tailEnd);
        i = tailEnd;
      } else {
        var end = i;
        while (end < len && input[end] !== "," && input[end] !== "\r" && input[end] !== "\n") end++;
        field = input.slice(i, end);
        i = end;
      }

      row.push(field);
      if (i >= len) break;
      var sep = input[i];
      i++;
      if (sep === "\r" || sep === "\n") {
        if (sep === "\r" && input[i] === "\n") i++;
        rows.push(row);
        row = [];
      }
    }

    if (row.length > 0) rows.push(row);

    return rows.filter(function (r) {
      return !(r.length === 1 && r[0].trim() === "");
    });
  }

  /** カードタイプのセルを分割・検証済みの配列にする(未知の値は無視) */
  function parseCardTypesCell(cell) {
    return String(cell || "")
      .split(/[\/,、]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(function (s) {
        return VALID_CARD_TYPES.indexOf(s) !== -1;
      });
  }

  /** 印刷枚数のセルを1以上の整数に変換する(空・不正値は1枚扱い) */
  function parseCopiesCell(cell) {
    var n = parseInt(cell, 10);
    if (!isFinite(n) || n < 1) return 1;
    return n;
  }

  function recordToRawCard(record) {
    return {
      name: record.name || "",
      manaCostString: record.manaCost || "",
      cardTypes: parseCardTypesCell(record.cardType),
      typeSubtype: record.typeSubtype || "",
      rulesText: String(record.rulesText || "").replace(/\\n/g, "\n"),
      flavorText: String(record.flavorText || "").replace(/\\n/g, "\n"),
      power: record.power || "",
      toughness: record.toughness || "",
      loyalty: record.loyalty || "",
      defense: record.defense || "",
      copies: parseCopiesCell(record.copies),
      artImage: null,
      artObjectUrl: null,
      artFileName: "",
      // 画像列(URLまたはbase64)。読み込みはapp.js側で非同期に行う
      artSource: String(record.artSource || "").trim()
    };
  }

  /** CSVテキストからカードのデータモデル配列を生成する。ヘッダー行が必須。 */
  function cardsFromCsvText(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return [];

    var headerKeys = rows[0].map(normalizeHeader);
    var results = [];

    for (var r = 1; r < rows.length; r++) {
      var cells = rows[r];
      if (cells.length === 1 && cells[0].trim() === "") continue;

      var record = {};
      for (var c = 0; c < headerKeys.length; c++) {
        var key = headerKeys[c];
        if (!key) continue;
        record[key] = cells[c] !== undefined ? cells[c] : "";
      }
      results.push(recordToRawCard(record));
    }

    return results;
  }

  function csvEscape(field) {
    var s = String(field == null ? "" : field);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function csvRow(cells) {
    return cells.map(csvEscape).join(",");
  }

  // CSVに埋め込む画像の長辺の上限(px)。元画像のままだとCSVが巨大になり読み込めなくなる
  var CSV_ART_MAX_SIZE = 1200;

  /**
   * カード画像をCSVの画像列に入れる文字列にする。通常は縮小したJPEGのbase64データURL。
   * CORS非対応で汚染された画像はcanvasから読み出せないため、元のURLをそのまま入れる。
   */
  function artToCsvField(card) {
    var img = card.artImage;
    if (!img) return "";
    if (card.artTainted) return img.src || "";
    try {
      var scale = Math.min(1, CSV_ART_MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch (e) {
      return img.src && !/^blob:/i.test(img.src) ? img.src : "";
    }
  }

  /** カードのデータモデル配列(cardsFromCsvTextと同形式)からCSVテキストを生成する */
  function cardsToCsvText(cards) {
    var header = ["名前", "マナコスト", "カードタイプ", "その他のタイプ", "パワー", "タフネス", "忠誠度", "守備値", "ルールテキスト", "フレイバーテキスト", "枚数", "画像"];
    var rows = [header].concat(
      (cards || []).map(function (card) {
        return [
          card.name || "",
          card.manaCostString || "",
          (card.cardTypes || []).join("/"),
          card.typeSubtype || "",
          card.power || "",
          card.toughness || "",
          card.loyalty || "",
          card.defense || "",
          card.rulesText || "",
          card.flavorText || "",
          card.copies || 1,
          artToCsvField(card)
        ];
      })
    );
    return rows.map(csvRow).join("\r\n");
  }

  /** 手元で試せるサンプルCSVを生成する */
  function generateSampleCsvText() {
    var header = ["名前", "マナコスト", "カードタイプ", "その他のタイプ", "パワー", "タフネス", "忠誠度", "守備値", "ルールテキスト", "フレイバーテキスト", "枚数"];
    var rows = [
      header,
      [
        "邪悪鳴らし",
        "1G",
        "ソーサリー",
        "",
        "",
        "",
        "",
        "",
        "あなたのライブラリーの一番上にあるカード4枚を公開する。その中からパーマネント・カード1枚をあなたの手札に加えてもよい。\n残りをあなたの墓地に置く。「このクリーチャーを生け贄に捧げる:{C}を加える。」を持つ無色の0/1のエルドラージ・落とし子・クリーチャー・トークン1体を生成する。",
        "変わり樹から出てきたものは、森そのものよりずっと湾曲したものだった。",
        "2"
      ],
      [
        "恐怖を喰うもの、ヴァルガヴォス",
        "6BBB",
        "伝説/クリーチャー",
        "エルダー・デーモン",
        "9",
        "9",
        "",
        "",
        "飛行、絆魂\n\n護法—土地でないパーマネント3つを生け贄に捧げる。\n\nあなたがコントロールしていなかったカードがいずこかから対戦相手の墓地に置かれるなら、代わりにそれを追放する。\nあなたのターンの間、恐怖を喰うもの、ヴァルガヴォスにより追放されているカードをプレイしてもよい。あなたがこれにより呪文を唱えるなら、マナ・コストを支払うのではなく、それのマナ総量に等しい点数のライフを支払う。",
        "",
        "1"
      ],
      [
        "ヴェールのリリアナ",
        "1BB",
        "伝説/プレインズウォーカー",
        "リリアナ",
        "",
        "",
        "3",
        "",
        "+1: 各プレイヤーはそれぞれカード1枚を捨てる。\n\n-2: プレイヤー1人を対象とする。そのプレイヤーはクリーチャー1体を生け贄に捧げる。\n\n-6: プレイヤー1人を対象とし、そのプレイヤーがコントロールしているパーマネントすべてを2つの束に分ける。そのプレイヤーは束1つを選び、その束にあるすべてのパーマネントを生け贄に捧げる。\n\n",
        "",
        "1"
      ],
      [
        "物語の結末",
        "2U",
        "英雄譚",
        "",
        "",
        "",
        "",
        "",
        "I: カード2枚を引く。\nII, III: 対戦相手がコントロールしているクリーチャー1体を対象とする。それをオーナーの手札に戻す。\nIV: あなたの墓地にあるインスタントかソーサリーである呪文1つを対象とする。それをコピーする。",
        "",
        "1"
      ],
      [
        "テスト次元への侵攻",
        "4R",
        "バトル",
        "包囲戦",
        "",
        "",
        "",
        "4",
        "テスト次元への侵攻が戦場に出たとき、クリーチャー1体を対象とする。テスト次元への侵攻はそれに3点のダメージを与える。",
        "",
        "1"
      ]
    ];
    return rows.map(csvRow).join("\r\n");
  }

  window.CardMaker.csvUtils = {
    VALID_CARD_TYPES: VALID_CARD_TYPES,
    parseCSV: parseCSV,
    cardsFromCsvText: cardsFromCsvText,
    cardsToCsvText: cardsToCsvText,
    generateSampleCsvText: generateSampleCsvText
  };
})();
