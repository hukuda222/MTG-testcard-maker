// マナコストのパース
window.CardMaker = window.CardMaker || {};

(function () {
  "use strict";

  var VALID_COLOR_LETTERS = { W: true, U: true, B: true, R: true, G: true };

  // 実際のMTGのマナシンボルに近い色分け。フレーム自体は白黒だが、
  // マナシンボルとタップ記号だけは実物同様の見た目にする。
  var MANA_SYMBOL_COLORS = {
    W: { fill: "#F9FAF4", stroke: "#000000", glyph: "#000000" },
    U: { fill: "#0E68AB", stroke: "#000000", glyph: "#FFFFFF" },
    B: { fill: "#1A1A1A", stroke: "#8A8A8A", glyph: "#FFFFFF" },
    R: { fill: "#D3202A", stroke: "#000000", glyph: "#FFFFFF" },
    G: { fill: "#00733E", stroke: "#000000", glyph: "#FFFFFF" },
    C: { fill: "#CFCFCF", stroke: "#000000", glyph: "#000000" },
    S: { fill: "#EAF4FA", stroke: "#000000", glyph: "#1B5E82" },
    E: { fill: "#1A1A1A", stroke: "#8A8A8A", glyph: "#FFFFFF" },
    generic: { fill: "#CFCFCF", stroke: "#000000", glyph: "#000000" },
    x: { fill: "#CFCFCF", stroke: "#000000", glyph: "#000000" }
  };
  var TAP_SYMBOL_STYLE = { fill: "#F5F3EA", stroke: "#000000", glyph: "#000000" };

  // 混成マナ("W/U"や"2/W"など): 単色/生成の2記号がスラッシュで組み合わさったもの
  // (先頭一致版は{}なしの裸表記のスキャン用、完全一致版は{}内のコード用)
  var HYBRID_PATTERN = /^(\d+|[WUBRGC])\/([WUBRGC])/;
  var HYBRID_PATTERN_EXACT = /^(\d+|[WUBRGC])\/([WUBRGC])$/;
  // ファイレクシアンマナ("W/P"など): 色マナ+Pの組み合わせ
  var PHYREXIAN_PATTERN = /^([WUBRG])\/P/;
  var PHYREXIAN_PATTERN_EXACT = /^([WUBRG])\/P$/;

  /** "{}"で囲まれた1個分のコードを、丸ごとトークンに変換する。認識できなければnull。 */
  function codeToToken(code) {
    var phyrexianMatch = PHYREXIAN_PATTERN_EXACT.exec(code);
    if (phyrexianMatch) return { type: "phyrexian", value: phyrexianMatch[1] };

    var hybridMatch = HYBRID_PATTERN_EXACT.exec(code);
    if (hybridMatch) return { type: "hybrid", left: hybridMatch[1], right: hybridMatch[2] };

    if (/^\d+$/.test(code)) return { type: "generic", value: parseInt(code, 10) };
    if (code === "X") return { type: "x", value: "X" };
    if (code === "C" || code === "S" || code === "E") return { type: "color", value: code };
    if (VALID_COLOR_LETTERS[code]) return { type: "color", value: code };
    return null;
  }

  /**
   * マナコストのショートハンド文字列("2WW", "{1}{U}{U}", "W/U", "{2/W}", "W/P" など)を
   * トークン列にパースする。"{...}"は1個の記号として区切って解釈するため、
   * "2{2/W}"のように連続していても数字同士が混ざらない。認識できない文字は無視する。
   */
  function parseManaCost(input) {
    var tokens = [];
    if (!input) return tokens;

    var raw = String(input).toUpperCase().replace(/\s/g, "");
    var i = 0;
    while (i < raw.length) {
      var ch = raw[i];

      if (ch === "{") {
        var end = raw.indexOf("}", i + 1);
        if (end === -1) {
          i++;
          continue;
        }
        var token = codeToToken(raw.slice(i + 1, end));
        if (token) tokens.push(token);
        i = end + 1;
        continue;
      }

      var rest = raw.slice(i);

      var phyrexianMatch = PHYREXIAN_PATTERN.exec(rest);
      if (phyrexianMatch) {
        tokens.push({ type: "phyrexian", value: phyrexianMatch[1] });
        i += phyrexianMatch[0].length;
        continue;
      }

      var hybridMatch = HYBRID_PATTERN.exec(rest);
      if (hybridMatch) {
        tokens.push({ type: "hybrid", left: hybridMatch[1], right: hybridMatch[2] });
        i += hybridMatch[0].length;
        continue;
      }

      if (ch >= "0" && ch <= "9") {
        var digits = "";
        while (i < raw.length && raw[i] >= "0" && raw[i] <= "9") {
          digits += raw[i];
          i++;
        }
        tokens.push({ type: "generic", value: parseInt(digits, 10) });
        continue;
      }
      if (ch === "X") {
        tokens.push({ type: "x", value: "X" });
        i++;
        continue;
      }
      if (ch === "C" || ch === "S" || ch === "E") {
        tokens.push({ type: "color", value: ch });
        i++;
        continue;
      }
      if (VALID_COLOR_LETTERS[ch]) {
        tokens.push({ type: "color", value: ch });
        i++;
        continue;
      }
      // 未知の文字(スラッシュ単独や"}"の取りこぼしなど)は読み飛ばす
      i++;
    }
    return tokens;
  }

  window.CardMaker.manaUtils = {
    MANA_SYMBOL_COLORS: MANA_SYMBOL_COLORS,
    TAP_SYMBOL_STYLE: TAP_SYMBOL_STYLE,
    parseManaCost: parseManaCost
  };
})();
