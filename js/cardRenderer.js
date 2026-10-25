// カードのcanvas描画。DOMには依存しない純粋関数群。
// WotCの「TEST CARD」(プレイテストカード)を模した、白黒の罫線ベースのデザイン。
window.CardMaker = window.CardMaker || {};

(function () {
  "use strict";

  var manaUtils = window.CardMaker.manaUtils;

  var INK = "#000000";
  var PAPER = "#FEFEFC";
  var PAPER_TINT = "#FBFAF4";
  // 数字は明朝体だと小さく細く見えるため、太いサンセリフ体で描く
  var NUMBER_FONT_FAMILY = "Arial, 'Helvetica Neue', Helvetica, 'Segoe UI', sans-serif";

  /** 角丸矩形のパスを構築する(fill/stroke/clipは呼び出し側で行う) */
  function roundRectPath(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  /** 罫線ボックス(白背景+黒枠線)を描画する */
  function drawBoxFrame(ctx, rect, lineWidth, fill) {
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = fill || PAPER;
    ctx.fill();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  /**
   * P/Tボックスのパスを構築する。実物のカードと同様、左右の辺を直線ではなく
   * 外側に膨らむ曲線にし、上下の辺は(角を軽く丸めつつ)ほぼ直線のまま残す。
   */
  function statBoxPath(ctx, rect) {
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    var midY = y + h / 2;
    var cornerR = Math.min(h * 0.22, w * 0.08);
    var bulge = w * 0.14;

    ctx.beginPath();
    ctx.moveTo(x + cornerR, y);
    ctx.lineTo(x + w - cornerR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + cornerR);
    ctx.quadraticCurveTo(x + w + bulge, midY, x + w, y + h - cornerR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - cornerR, y + h);
    ctx.lineTo(x + cornerR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - cornerR);
    ctx.quadraticCurveTo(x - bulge, midY, x, y + cornerR);
    ctx.quadraticCurveTo(x, y, x + cornerR, y);
    ctx.closePath();
  }

  /**
   * プレインズウォーカーの忠誠度バッジのパスを構築する(八角形、曲線なし)。
   * 上辺は中央がへこんだ山型2辺、下辺は中央が尖った2辺で、左右は斜めカット。
   */
  function loyaltyShieldPath(ctx, rect) {
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    var cutX = w * 0.3;
    var cutY = h * 0.3;
    var dipDepth = h * 0.16;
    // 下側4辺(L1/R1を含む)の位置は変えず、上側の山型部分だけを
    // cutYの手前側(L1/R1に近い側)へ圧縮して縦方向に潰す。
    var topCrownHeight = cutY * 0.5;
    var shoulderY = cutY - topCrownHeight;
    var dipY = shoulderY + topCrownHeight * (dipDepth / cutY);
    // R1/R2/L1/L2や上側はそのままに、底の尖り(下2辺)だけをcutYの
    // 手前側(R2/L2に近い側)へ圧縮して縦方向に潰す。
    var bottomPointHeight = cutY * 0.5;
    var bottomPointY = h - cutY + bottomPointHeight;
    // 左右の垂直な辺(L1-L2, R1-R2)を15度傾け、下端(L2/R2)だけを
    // 中央へ寄せる(上端のL1/R1は動かさない)。
    var verticalEdgeHeight = (h - cutY) - cutY;
    var tiltShift = verticalEdgeHeight * Math.tan((15 * Math.PI) / 180);

    ctx.beginPath();
    ctx.moveTo(x, y + cutY);
    ctx.lineTo(x + cutX, y + shoulderY);
    ctx.lineTo(x + w / 2, y + dipY);
    ctx.lineTo(x + w - cutX, y + shoulderY);
    ctx.lineTo(x + w, y + cutY);
    ctx.lineTo(x + w - tiltShift, y + h - cutY);
    ctx.lineTo(x + w / 2, y + bottomPointY);
    ctx.lineTo(x + tiltShift, y + h - cutY);
    ctx.closePath();
  }

  /** 曲線パス(P/Tボックス・忠誠度バッジ)を白背景+黒太枠で塗り分けて描画する */
  function drawCurvedBadge(ctx, pathFn, rect, lineWidth) {
    pathFn(ctx, rect);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  /** width/heightからカード各領域の矩形を比率ベースで計算する */
  function computeLayout(width, height) {
    var outerInset = 0.025 * width;
    var cornerRadius = 0.025 * width;
    var inset = 0.045 * width;
    var gap = 0.012 * height;

    function region(yStart, yEnd) {
      return {
        x: inset,
        y: yStart * height,
        w: width - inset * 2,
        h: (yEnd - yStart) * height
      };
    }

    var nameBar = region(0.035, 0.1);
    var artBox = region(0.1 + gap / height, 0.47);
    var typeLine = region(0.47 + gap / height, 0.525);
    var rulesBox = region(0.525 + gap / height, 0.94);

    // テキストボックスの下辺と一部重なるように配置する(実物のP/Tボックスと同様)。
    // ただし外枠の下辺は絶対に超えないようクランプする。
    var ptBox = {
      w: 0.2 * width,
      h: 0.06 * height
    };
    ptBox.x = width - inset - ptBox.w;
    ptBox.y = rulesBox.y + rulesBox.h - ptBox.h * 0.6;
    var maxPtBoxBottom = height - outerInset - gap * 0.5;
    if (ptBox.y + ptBox.h > maxPtBoxBottom) {
      ptBox.y = maxPtBoxBottom - ptBox.h;
    }

    // 忠誠度バッジは実物同様、縦長の盾形なのでP/Tボックスより背が高く幅は狭い。
    var loyaltyBox = {
      w: 0.16 * width,
      h: 0.12 * height
    };
    // 右辺が内枠(inset)と外枠(outerInset)のちょうど中間に来るよう配置する。
    var loyaltyRightEdge = width - (inset + outerInset) / 2;
    loyaltyBox.x = loyaltyRightEdge - loyaltyBox.w;
    loyaltyBox.y = rulesBox.y + rulesBox.h + loyaltyBox.h * 0.3;
    // ptBoxより先端が尖っている分、より下まで(一番外側の枠のすぐ内側まで)
    // 許容してよいので、専用の下限でクランプする。
    var maxLoyaltyBoxBottom = height - outerInset * 0.4;
    if (loyaltyBox.y + loyaltyBox.h > maxLoyaltyBoxBottom) {
      loyaltyBox.y = maxLoyaltyBoxBottom - loyaltyBox.h;
    }

    return {
      outerInset: outerInset,
      cornerRadius: cornerRadius,
      inset: inset,
      nameBar: nameBar,
      artBox: artBox,
      typeLine: typeLine,
      rulesBox: rulesBox,
      ptBox: ptBox,
      loyaltyBox: loyaltyBox
    };
  }

  /**
   * 英雄譚のレイアウト。通常レイアウトをベースに、左半分を章テキストの列、
   * 右半分を縦長のイラスト枠にし、タイプ行はカード下部に置く。
   */
  function computeSagaLayout(width, height) {
    var layout = computeLayout(width, height);
    var gap = 0.012 * height;
    var inset = layout.inset;
    var innerW = width - inset * 2;
    var columnTop = layout.nameBar.y + layout.nameBar.h + gap;
    var typeLine = { x: inset, y: 0.87 * height, w: innerW, h: 0.055 * height };
    var columnH = typeLine.y - gap - columnTop;
    var textW = innerW * 0.5 - gap / 2;

    layout.rulesBox = { x: inset, y: columnTop, w: textW, h: columnH };
    layout.artBox = { x: inset + textW + gap, y: columnTop, w: innerW - textW - gap, h: columnH };
    layout.typeLine = typeLine;
    return layout;
  }

  /**
   * バトルのレイアウト。バトルは横向きのカードなので、横長(width > height)の
   * 座標系で計算する。縦横の基準寸法は短辺(height)に揃える。
   */
  function computeBattleLayout(width, height) {
    var outerInset = 0.025 * height;
    var cornerRadius = 0.025 * height;
    var inset = 0.045 * height;
    var gap = 0.012 * width;

    function region(yStart, yEnd) {
      return { x: inset, y: yStart * height, w: width - inset * 2, h: (yEnd - yStart) * height };
    }

    var nameBar = region(0.045, 0.136);
    var artBox = region(0.136 + gap / height, 0.56);
    var typeLine = region(0.56 + gap / height, 0.637);
    var rulesBox = region(0.637 + gap / height, 0.92);

    var defenseBox = { w: 0.11 * width, h: 0.11 * height };
    defenseBox.x = width - inset - defenseBox.w;
    defenseBox.y = rulesBox.y + rulesBox.h - defenseBox.h * 0.6;
    var maxBottom = height - outerInset - gap * 0.5;
    if (defenseBox.y + defenseBox.h > maxBottom) {
      defenseBox.y = maxBottom - defenseBox.h;
    }

    return {
      outerInset: outerInset,
      cornerRadius: cornerRadius,
      inset: inset,
      nameBar: nameBar,
      artBox: artBox,
      typeLine: typeLine,
      rulesBox: rulesBox,
      defenseBox: defenseBox,
      // ルールボックスが通常カードより低いため、文字サイズは短辺基準で決める
      rulesBaseFontSize: 0.027 * width
    };
  }

  /** 画像をcover-fitで矩形内に描画する(はみ出た部分は中央基準でクロップ) */
  function drawImageCover(ctx, img, x, y, w, h) {
    var scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var sw = w / scale;
    var sh = h / scale;
    var sx = (img.naturalWidth - sw) / 2;
    var sy = (img.naturalHeight - sh) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
  }

  var ASCII_WORD_CHAR = /[A-Za-z0-9']/;
  // 行頭に置かない句読点。幅がわずかに超えても前の行に残す。
  var NO_LINE_START_PUNCTUATION = /^[。、）］｝〉》」』】〕〙〗”’!?！？]/;

  /**
   * 段落を折り返し可能な最小単位(チャンク)の配列に分解する。
   * 日本語などのCJK文字はスペースを含まないため、文字単位でどこでも改行できる
   * ようにする。ASCIIの英数字は単語としてまとめ、"{T}"のようなシンボル記法は
   * 1個の塊として扱う。空白は直後のチャンクの先頭に付けて幅をそのまま保つ。
   */
  function tokenizeParagraphIntoChunks(paragraph) {
    var chunks = [];
    var pendingSpace = "";
    var i = 0;
    var n = paragraph.length;

    function pushChunk(atoms) {
      if (pendingSpace) {
        atoms = [{ type: "text", value: pendingSpace }].concat(atoms);
        pendingSpace = "";
      }
      chunks.push(atoms);
    }

    while (i < n) {
      var ch = paragraph[i];

      if (/\s/.test(ch)) {
        var spaceStart = i;
        while (i < n && /\s/.test(paragraph[i])) i++;
        pendingSpace += paragraph.slice(spaceStart, i);
        continue;
      }

      if (ch === "{") {
        var closeIndex = paragraph.indexOf("}", i + 1);
        if (closeIndex !== -1) {
          pushChunk([{ type: "symbol", code: paragraph.slice(i + 1, closeIndex).toUpperCase() }]);
          i = closeIndex + 1;
          continue;
        }
      }

      if (ASCII_WORD_CHAR.test(ch)) {
        var wordStart = i;
        while (i < n && ASCII_WORD_CHAR.test(paragraph[i])) i++;
        pushChunk([{ type: "text", value: paragraph.slice(wordStart, i) }]);
        continue;
      }

      // それ以外(日本語や記号など)は1文字ずつ独立したチャンクにする
      pushChunk([{ type: "text", value: ch }]);
      i++;
    }

    if (pendingSpace) {
      if (chunks.length) {
        chunks[chunks.length - 1] = chunks[chunks.length - 1].concat([{ type: "text", value: pendingSpace }]);
      } else {
        chunks.push([{ type: "text", value: pendingSpace }]);
      }
    }

    return chunks;
  }

  /** シンボル記法のコード("T", "W", "2", "X", "W/U"など)をdrawManaSymbol用のトークンに変換する */
  function codeToManaToken(code) {
    if (code === "T") return { type: "tap" };
    if (code === "Q") return { type: "untap" };
    if (/^[WUBRG]\/P$/.test(code)) {
      return { type: "phyrexian", value: code.split("/")[0] };
    }
    if (code.indexOf("/") !== -1) {
      var parts = code.split("/");
      return { type: "hybrid", left: parts[0], right: parts[1] };
    }
    if (/^\d+$/.test(code)) return { type: "generic", value: parseInt(code, 10) };
    if (code === "X") return { type: "x", value: "X" };
    return { type: "color", value: code };
  }

  function measureAtomsWidth(ctx, atoms, fontSize) {
    var width = 0;
    atoms.forEach(function (atom) {
      width += atom.type === "symbol" ? fontSize * 0.95 : ctx.measureText(atom.value).width;
    });
    return width;
  }

  function mustStayWithPreviousLine(atoms) {
    return atoms.length === 1 && atoms[0].type === "text" && NO_LINE_START_PUNCTUATION.test(atoms[0].value);
  }

  /**
   * テキストを段落(\n)・単語単位で折り返し、行の配列(各行はテキスト/シンボルの
   * アトム配列)を返す。ctx.fontはこの関数が設定する。
   */
  function wrapRichText(ctx, text, maxWidth, fontSize, fontFamily, italic, bold) {
    if (!text) return [];
    ctx.font = (italic ? "italic " : "") + (bold ? "bold " : "") + fontSize + "px " + fontFamily;
    var paragraphs = String(text).split("\n");
    var lines = [];

    paragraphs.forEach(function (paragraph) {
      if (paragraph === "") {
        lines.push([]);
        return;
      }
      var chunks = tokenizeParagraphIntoChunks(paragraph);
      var currentAtoms = [];
      var currentWidth = 0;

      chunks.forEach(function (chunkAtoms) {
        var chunkWidth = measureAtomsWidth(ctx, chunkAtoms, fontSize);
        if (currentAtoms.length && currentWidth + chunkWidth > maxWidth && !mustStayWithPreviousLine(chunkAtoms)) {
          lines.push(currentAtoms);
          currentAtoms = chunkAtoms.slice();
          currentWidth = chunkWidth;
        } else {
          currentAtoms = currentAtoms.concat(chunkAtoms);
          currentWidth += chunkWidth;
        }
      });

      if (currentAtoms.length) lines.push(currentAtoms);
    });

    return lines;
  }

  /** wrapRichTextの生の行(アトム配列)を、インデント/バッジ情報付きの行オブジェクトに変換する */
  function toPlainLines(rawLines) {
    return rawLines.map(function (atoms) {
      return { atoms: atoms, indent: 0, badge: null };
    });
  }

  // 忠誠度能力のコスト表記("{+1:}"、"{-2:}"、"{-X:}"、"{0:}"など、
  // "{"の直後が+/-または0で始まり、"}"の直前にコロンを持つもの)を段落の先頭で検出する。
  var LOYALTY_ABILITY_PATTERN = /^\{([+\-]\d+|[+\-]X|0):\}\s*/i;

  /**
   * プレインズウォーカーのルールテキストを折り返す。各段落が忠誠度コストの
   * 表記で始まる場合はコストをバッジ表示用に切り出し、残りのテキストは
   * バッジ分だけインデントして(2行目以降も同じ位置で)折り返す。
   */
  function wrapPlaneswalkerRulesText(ctx, text, maxWidth, fontSize, fontFamily) {
    if (!text) return [];
    var badgeGap = fontSize * 0.3;
    var badgeWidth = fontSize * 2.1;
    var indent = badgeWidth + badgeGap;
    var paragraphs = String(text).split("\n");
    var lines = [];

    paragraphs.forEach(function (paragraph) {
      if (paragraph === "") {
        lines.push({ atoms: [], indent: 0, badge: null });
        return;
      }
      var match = paragraph.match(LOYALTY_ABILITY_PATTERN);
      if (match) {
        var cost = match[1].toUpperCase();
        var rest = paragraph.slice(match[0].length);
        var subLines = wrapRichText(ctx, rest, maxWidth - indent, fontSize, fontFamily, false, true);
        if (!subLines.length) subLines = [[]];
        subLines.forEach(function (atoms, idx) {
          lines.push({
            atoms: atoms,
            indent: indent,
            badge: idx === 0 ? cost : null,
            badgeWidth: badgeWidth
          });
        });
      } else {
        wrapRichText(ctx, paragraph, maxWidth, fontSize, fontFamily, false, true).forEach(function (atoms) {
          lines.push({ atoms: atoms, indent: 0, badge: null });
        });
      }
    });

    return lines;
  }

  /**
   * ルールテキスト・フレイバーテキストをボックスに収まるようフォントサイズを
   * 自動調整しながら折り返す。
   */
  function fitTextBlock(ctx, card, box, baseFontSizePx, fontFamily) {
    var fontSize = baseFontSizePx;
    var minFontSize = baseFontSizePx * 0.5;
    var paddingX = box.w * 0.02;
    var paddingY = box.h * 0.02;
    var maxWidth = box.w - paddingX * 2;
    var rulesLines, flavorLines, lineHeight, dividerGap, totalHeight;

    while (true) {
      rulesLines = card.isPlaneswalker
        ? wrapPlaneswalkerRulesText(ctx, card.rulesText, maxWidth, fontSize, fontFamily)
        : toPlainLines(wrapRichText(ctx, card.rulesText, maxWidth, fontSize, fontFamily, false, true));
      flavorLines = toPlainLines(wrapRichText(ctx, card.flavorText, maxWidth, fontSize, fontFamily, true, false));

      lineHeight = fontSize * 1.18;
      dividerGap = rulesLines.length && flavorLines.length ? fontSize * 0.7 : 0;
      totalHeight =
        rulesLines.length * lineHeight + flavorLines.length * lineHeight + dividerGap;

      if (totalHeight <= box.h - paddingY * 2 || fontSize <= minFontSize) {
        break;
      }
      fontSize -= 1;
    }

    return {
      rulesLines: rulesLines,
      flavorLines: flavorLines,
      fontSize: fontSize,
      lineHeight: lineHeight,
      dividerGap: dividerGap,
      paddingX: paddingX,
      paddingY: paddingY
    };
  }

  /**
   * 忠誠度能力コストのバッジ形状(旗/矢羽根形)のパスを構築する。実物カード
   * 同様、左辺はルールボックスの罫線に沿ってフラット(左上下のみ軽く丸め)、
   * 右辺は本文側に向かって鋭く尖る。
   */
  function abilityCostBadgePath(ctx, rect) {
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    var pointDepth = h * 0.42;
    var leftCornerR = Math.min(h * 0.14, w * 0.12);

    ctx.beginPath();
    ctx.moveTo(x + leftCornerR, y);
    ctx.lineTo(x + w - pointDepth, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w - pointDepth, y + h);
    ctx.lineTo(x + leftCornerR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - leftCornerR);
    ctx.lineTo(x, y + leftCornerR);
    ctx.quadraticCurveTo(x, y, x + leftCornerR, y);
    ctx.closePath();
  }

  /**
   * 忠誠度能力のコスト("+1"、"-2"、"-X"など)を表示するバッジを描画する。
   * 黒地に白抜き文字の旗形(abilityCostBadgePath)。
   */
  function drawAbilityCostBadge(ctx, cx, cy, w, h, label, fontSize) {
    var rect = { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
    var pointDepth = h * 0.42;
    abilityCostBadgePath(ctx, rect);
    ctx.fillStyle = INK;
    ctx.fill();

    ctx.fillStyle = PAPER;
    ctx.font = "bold " + Math.round(fontSize * 0.85) + "px " + NUMBER_FONT_FAMILY;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + (rect.w - pointDepth) / 2, cy);
  }

  /** 円+回転矢印(タップ/アンタップ記号)を描画する */
  function drawRotateArrowIcon(ctx, cx, cy, diameter, style, clockwise) {
    var radius = diameter / 2;
    var arcRadius = radius * 0.52;
    var startAngle = -Math.PI * 0.75;
    var sweepMagnitude = Math.PI * 1.6;
    var sweepStart = startAngle;
    var sweepEnd = clockwise ? startAngle + sweepMagnitude : startAngle - sweepMagnitude;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, diameter * 0.08);
    ctx.strokeStyle = style.stroke;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius, sweepStart, sweepEnd, !clockwise);
    ctx.lineWidth = Math.max(1, diameter * 0.11);
    ctx.strokeStyle = style.glyph;
    ctx.lineCap = "round";
    ctx.stroke();

    var endAngle = sweepEnd;
    var dirX = clockwise ? -Math.sin(endAngle) : Math.sin(endAngle);
    var dirY = clockwise ? Math.cos(endAngle) : -Math.cos(endAngle);
    var tipX = cx + arcRadius * Math.cos(endAngle);
    var tipY = cy + arcRadius * Math.sin(endAngle);
    var headLen = diameter * 0.22;
    var headWidth = diameter * 0.14;
    var perpX = -dirY;
    var perpY = dirX;

    ctx.beginPath();
    ctx.moveTo(tipX + dirX * headLen * 0.6, tipY + dirY * headLen * 0.6);
    ctx.lineTo(tipX + perpX * headWidth - dirX * headLen * 0.4, tipY + perpY * headWidth - dirY * headLen * 0.4);
    ctx.lineTo(tipX - perpX * headWidth - dirX * headLen * 0.4, tipY - perpY * headWidth - dirY * headLen * 0.4);
    ctx.closePath();
    ctx.fillStyle = style.glyph;
    ctx.fill();
    ctx.restore();
  }

  /** マナシンボル1個を描画する。W/U/B/R/Gは実際の色に近い配色、タップ/アンタップは回転矢印アイコン。 */
  /** 白マナ: 太陽(サンバースト) */
  function drawSunIcon(ctx, cx, cy, r, color) {
    var rays = 8;
    var innerR = r * 0.38;
    var outerR = r * 0.88;
    ctx.beginPath();
    for (var i = 0; i < rays * 2; i++) {
      var angle = (Math.PI / rays) * i - Math.PI / 2;
      var rad = i % 2 === 0 ? outerR : innerR;
      var x = cx + rad * Math.cos(angle);
      var y = cy + rad * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /** 青マナ: 水滴 */
  function drawDropletIcon(ctx, cx, cy, r, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.9);
    ctx.bezierCurveTo(cx + r * 0.78, cy - r * 0.05, cx + r * 0.62, cy + r * 0.85, cx, cy + r * 0.85);
    ctx.bezierCurveTo(cx - r * 0.62, cy + r * 0.85, cx - r * 0.78, cy - r * 0.05, cx, cy - r * 0.9);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /** 黒マナ: 頭蓋骨 */
  function drawSkullIcon(ctx, cx, cy, r, color, bgColor) {
    function px(x) { return cx + r * x; }
    function py(y) { return cy + r * y; }

    // 頭蓋（丸い頭頂から頬骨へ）と下顎
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px(-0.5), py(0.12));
    ctx.bezierCurveTo(px(-0.66), py(-0.2), px(-0.56), py(-0.74), px(0), py(-0.76));
    ctx.bezierCurveTo(px(0.56), py(-0.74), px(0.66), py(-0.2), px(0.5), py(0.12));
    ctx.quadraticCurveTo(px(0.44), py(0.3), px(0.3), py(0.34));
    ctx.lineTo(px(0.3), py(0.66));
    ctx.quadraticCurveTo(px(0.3), py(0.76), px(0.2), py(0.76));
    ctx.lineTo(px(-0.2), py(0.76));
    ctx.quadraticCurveTo(px(-0.3), py(0.76), px(-0.3), py(0.66));
    ctx.lineTo(px(-0.3), py(0.34));
    ctx.quadraticCurveTo(px(-0.44), py(0.3), px(-0.5), py(0.12));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = bgColor;
    // 目: 内側が下がった大きな眼窩
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(px(s * 0.06), py(-0.12));
      ctx.quadraticCurveTo(px(s * 0.2), py(-0.3), px(s * 0.42), py(-0.22));
      ctx.quadraticCurveTo(px(s * 0.46), py(0.04), px(s * 0.26), py(0.12));
      ctx.quadraticCurveTo(px(s * 0.08), py(0.12), px(s * 0.06), py(-0.12));
      ctx.closePath();
      ctx.fill();
    });

    // 鼻: 逆ハート型の小さな穴
    ctx.beginPath();
    ctx.moveTo(px(0), py(0.12));
    ctx.lineTo(px(-0.08), py(0.3));
    ctx.quadraticCurveTo(px(0), py(0.26), px(0.08), py(0.3));
    ctx.closePath();
    ctx.fill();

    // 歯の隙間
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.strokeStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(px(-0.3), py(0.5));
    ctx.lineTo(px(0.3), py(0.5));
    [-0.15, 0, 0.15].forEach(function (x) {
      ctx.moveTo(px(x), py(0.4));
      ctx.lineTo(px(x), py(0.76));
    });
    ctx.stroke();
  }

  /** 赤マナ: 本家風の火の玉(下半分を占める黒い球から1本の炎が右側から上をぐるっと回って伸び、内側に背景色の渦模様) */
  function drawFlameIcon(ctx, cx, cy, r, color) {
    var patternColor = manaUtils.MANA_SYMBOL_COLORS.R.pattern;
    function circle(x, y, radius, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(cx + r * x, cy + r * y, r * radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // [始点, [制御点, 終点], ...] の2次ベジェで閉じた形を塗る
    function tongue(points, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(cx + r * points[0][0], cy + r * points[0][1]);
      for (var i = 1; i < points.length; i++) {
        var c = points[i][0];
        var e = points[i][1];
        ctx.quadraticCurveTo(cx + r * c[0], cy + r * c[1], cx + r * e[0], cy + r * e[1]);
      }
      ctx.closePath();
      ctx.fill();
    }

    circle(-0.05, 0.38, 0.55, color);
    // 炎の舌: 右下から円に沿って右側・上側をぐるっと回り込み、左上で先端になる。外側の縁はギザギザに揺らす
    tongue([
      [0.25, 0.85],
      [[0.65, 0.78], [0.8, 0.5]],
      [[0.78, 0.4], [0.7, 0.35]],
      [[0.92, 0.2], [0.9, -0.05]],
      [[0.82, -0.1], [0.74, -0.12]],
      [[0.9, -0.35], [0.78, -0.55]],
      [[0.68, -0.55], [0.6, -0.52]],
      [[0.55, -0.8], [0.25, -0.88]],
      [[0.2, -0.78], [0.12, -0.76]],
      [[-0.1, -0.95], [-0.45, -0.82]],
      [[-0.65, -0.72], [-0.72, -0.45]],
      [[-0.4, -0.65], [0.0, -0.6]],
      [[0.5, -0.5], [0.45, 0.0]],
      [[0.4, 0.2], [0.2, 0.0]]
    ], color);
    // 炎の途切れ: 右上で舌を細く切り離す
    tongue([[0.62, -0.62], [[0.5, -0.5], [0.35, -0.48]], [[0.5, -0.58], [0.58, -0.7]]], patternColor);
    // 先端付近に飛ぶ小さな火の粉
    tongue([[-0.6, -0.25], [[-0.68, -0.4], [-0.82, -0.5]], [[-0.75, -0.3], [-0.6, -0.25]]], color);

    // 内側の渦: 背景色の円を黒い円でずらして欠いて三日月形にし、中心に小さな渦を重ねる
    circle(0.06, 0.3, 0.36, patternColor);
    circle(-0.05, 0.41, 0.3, color);
    circle(0.06, 0.19, 0.11, patternColor);
    circle(0.12, 0.26, 0.07, color);
  }

  /** 緑マナ: 木 */
  function drawTreeIcon(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;

    // 幹（根元を少し広げる）
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.1, cy + r * 0.05);
    ctx.lineTo(cx + r * 0.1, cy + r * 0.05);
    ctx.lineTo(cx + r * 0.13, cy + r * 0.68);
    ctx.quadraticCurveTo(cx + r * 0.16, cy + r * 0.78, cx + r * 0.28, cy + r * 0.8);
    ctx.lineTo(cx - r * 0.28, cy + r * 0.8);
    ctx.quadraticCurveTo(cx - r * 0.16, cy + r * 0.78, cx - r * 0.13, cy + r * 0.68);
    ctx.closePath();
    ctx.fill();

    // 丸い葉の茂み
    [
      [0, -0.42, 0.36],
      [-0.33, -0.18, 0.3],
      [0.33, -0.18, 0.3],
      [-0.18, 0.08, 0.26],
      [0.18, 0.08, 0.26],
      [0, -0.12, 0.3]
    ].forEach(function (c) {
      ctx.beginPath();
      ctx.arc(cx + r * c[0], cy + r * c[1], r * c[2], 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** 氷雪マナ: 雪の結晶 */
  function drawSnowflakeIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, r * 0.15);

    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI / 3) * i;
      var dx = Math.cos(angle);
      var dy = Math.sin(angle);
      var tipX = cx + r * 0.82 * dx;
      var tipY = cy + r * 0.82 * dy;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      var midX = cx + r * 0.48 * dx;
      var midY = cy + r * 0.48 * dy;
      var branchLen = r * 0.24;
      [angle + Math.PI / 4, angle - Math.PI / 4].forEach(function (branchAngle) {
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + branchLen * Math.cos(branchAngle), midY + branchLen * Math.sin(branchAngle));
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  /** 無色マナ: 他のシンボルと同様に円で囲み、内側にひし形の輪郭を描いて区別する */
  function drawColorlessDiamond(ctx, cx, cy, diameter, style) {
    var radius = diameter / 2;
    var half = radius * 0.62;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, diameter * 0.08);
    ctx.strokeStyle = style.stroke;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, cy + half);
    ctx.lineTo(cx - half, cy);
    ctx.closePath();
    ctx.lineWidth = Math.max(1, diameter * 0.06);
    ctx.strokeStyle = style.stroke;
    ctx.stroke();
    ctx.restore();
  }

  /** エネルギー: 稲妻 */
  function drawLightningBoltIcon(ctx, cx, cy, r, color) {
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.12, cy - r * 0.85);
    ctx.lineTo(cx - r * 0.55, cy + r * 0.15);
    ctx.lineTo(cx - r * 0.08, cy + r * 0.15);
    ctx.lineTo(cx - r * 0.12, cy + r * 0.85);
    ctx.lineTo(cx + r * 0.55, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.08, cy - r * 0.15);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  var COLOR_ICON_DRAWERS = {
    W: function (ctx, cx, cy, r, glyphColor) {
      drawSunIcon(ctx, cx, cy, r, glyphColor);
    },
    U: function (ctx, cx, cy, r, glyphColor) {
      drawDropletIcon(ctx, cx, cy, r, glyphColor);
    },
    B: function (ctx, cx, cy, r, glyphColor, fillColor) {
      drawSkullIcon(ctx, cx, cy, r, glyphColor, fillColor);
    },
    R: function (ctx, cx, cy, r, glyphColor) {
      drawFlameIcon(ctx, cx, cy, r, glyphColor);
    },
    G: function (ctx, cx, cy, r, glyphColor) {
      drawTreeIcon(ctx, cx, cy, r, glyphColor);
    },
    S: function (ctx, cx, cy, r, glyphColor) {
      drawSnowflakeIcon(ctx, cx, cy, r, glyphColor);
    }
  };

  /** エネルギー: 実物同様、円ではなく盾形(五角形)の中に稲妻を描く */
  function drawEnergySymbol(ctx, cx, cy, diameter, style) {
    var r = diameter / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.85, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.85, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.05);
    ctx.lineTo(cx, cy + r * 0.95);
    ctx.lineTo(cx - r * 0.85, cy + r * 0.05);
    ctx.closePath();
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, diameter * 0.06);
    ctx.strokeStyle = style.stroke;
    ctx.stroke();

    drawLightningBoltIcon(ctx, cx, cy, r * 0.65, style.glyph);
    ctx.restore();
  }

  function styleForHybridCode(code) {
    if (/^\d+$/.test(code)) return manaUtils.MANA_SYMBOL_COLORS.generic;
    return manaUtils.MANA_SYMBOL_COLORS[code] || manaUtils.MANA_SYMBOL_COLORS.generic;
  }

  function drawHybridHalfLabel(ctx, code, x, y, radius, glyphColor) {
    var isNumeric = /^\d+$/.test(code);
    var fontFamily = isNumeric
      ? NUMBER_FONT_FAMILY
      : "'Yu Gothic', 'Hiragino Kaku Gothic ProN', Meiryo, Arial, sans-serif";
    ctx.fillStyle = glyphColor;
    ctx.font = "bold " + Math.round(radius * 0.55) + "px " + fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(code, x, y);
  }

  /** 混成マナ("W/U"、"2/W"など)。円を対角線状に2色で塗り分け、それぞれの色/アイコンを描く */
  function drawHybridSymbol(ctx, cx, cy, diameter, leftCode, rightCode) {
    var radius = diameter / 2;
    var leftStyle = styleForHybridCode(leftCode);
    var rightStyle = styleForHybridCode(rightCode);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // 左上半分
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy - radius);
    ctx.lineTo(cx + radius, cy - radius);
    ctx.lineTo(cx - radius, cy + radius);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = leftStyle.fill;
    ctx.fillRect(cx - radius, cy - radius, diameter, diameter);
    var leftIcon = COLOR_ICON_DRAWERS[leftCode];
    if (leftIcon) {
      leftIcon(ctx, cx - radius * 0.32, cy - radius * 0.32, radius * 0.52, leftStyle.glyph, leftStyle.fill);
    } else {
      drawHybridHalfLabel(ctx, leftCode, cx - radius * 0.36, cy - radius * 0.36, radius, leftStyle.glyph);
    }
    ctx.restore();

    // 右下半分
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + radius, cy + radius);
    ctx.lineTo(cx - radius, cy + radius);
    ctx.lineTo(cx + radius, cy - radius);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = rightStyle.fill;
    ctx.fillRect(cx - radius, cy - radius, diameter, diameter);
    var rightIcon = COLOR_ICON_DRAWERS[rightCode];
    if (rightIcon) {
      rightIcon(ctx, cx + radius * 0.32, cy + radius * 0.32, radius * 0.52, rightStyle.glyph, rightStyle.fill);
    } else {
      drawHybridHalfLabel(ctx, rightCode, cx + radius * 0.36, cy + radius * 0.36, radius, rightStyle.glyph);
    }
    ctx.restore();
    ctx.restore();

    // 外周
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, diameter * 0.08);
    ctx.strokeStyle = "#000000";
    ctx.stroke();
  }

  /** ファイレクシアンマナ("W/P"など): 色マナシンボルの右下に黒いΨ(プシー)バッジを重ねる */
  /**
   * ファイレクシアン紋章(Ψ風のトライデント形)をベクターパスで描く。
   * フォント任せのグリフだと環境によって表示が崩れる(バツ印に見えるなど)ため使わない。
   */
  function drawPhyrexianInsignia(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";

    var stemHalfWidth = r * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx - stemHalfWidth, cy - r * 0.85);
    ctx.lineTo(cx - stemHalfWidth, cy + r * 0.85);
    ctx.lineTo(cx + stemHalfWidth, cy + r * 0.85);
    ctx.lineTo(cx + stemHalfWidth, cy - r * 0.85);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.05, r * 0.56, r * 0.64, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * ファイレクシアンマナ("W/P"など)。通常のマナシンボルと違い、色は背景の塗りだけに
   * 反映し、アイコンは色に依らない固定のファイレクシアン紋章にする。
   */
  function drawPhyrexianSymbol(ctx, cx, cy, diameter, colorLetter) {
    var style = manaUtils.MANA_SYMBOL_COLORS[colorLetter] || manaUtils.MANA_SYMBOL_COLORS.generic;
    var radius = diameter / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, diameter * 0.08);
    ctx.strokeStyle = style.stroke;
    ctx.stroke();

    drawPhyrexianInsignia(ctx, cx, cy, radius * 0.75, style.glyph);
    ctx.restore();
  }

  function drawManaSymbol(ctx, cx, cy, diameter, token) {
    if (token.type === "tap") {
      drawRotateArrowIcon(ctx, cx, cy, diameter, manaUtils.TAP_SYMBOL_STYLE, true);
      return;
    }
    if (token.type === "untap") {
      drawRotateArrowIcon(ctx, cx, cy, diameter, manaUtils.TAP_SYMBOL_STYLE, false);
      return;
    }
    if (token.type === "hybrid") {
      drawHybridSymbol(ctx, cx, cy, diameter, token.left, token.right);
      return;
    }
    if (token.type === "phyrexian") {
      drawPhyrexianSymbol(ctx, cx, cy, diameter, token.value);
      return;
    }

    var key = token.type === "generic" ? "generic" : token.type === "x" ? "x" : token.value;
    var style = manaUtils.MANA_SYMBOL_COLORS[key] || manaUtils.MANA_SYMBOL_COLORS.generic;

    if (key === "C") {
      drawColorlessDiamond(ctx, cx, cy, diameter, style);
      return;
    }
    if (key === "E") {
      drawEnergySymbol(ctx, cx, cy, diameter, style);
      return;
    }

    var radius = diameter / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, diameter * 0.08);
    ctx.strokeStyle = style.stroke;
    ctx.stroke();

    var iconDrawer = COLOR_ICON_DRAWERS[key];
    if (iconDrawer) {
      iconDrawer(ctx, cx, cy, radius, style.glyph, style.fill);
    } else {
      var label = token.type === "generic" ? String(token.value) : token.type === "x" ? "X" : token.value;
      var isNumeric = token.type === "generic" || token.type === "x";
      var glyphFontFamily = isNumeric
        ? NUMBER_FONT_FAMILY
        : "'Yu Gothic', 'Hiragino Kaku Gothic ProN', Meiryo, Arial, sans-serif";
      ctx.fillStyle = style.glyph;
      ctx.font = "bold " + Math.round(diameter * (label.length > 1 ? 0.55 : 0.8)) + "px " + glyphFontFamily;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, cy + diameter * 0.03);
    }
    ctx.restore();
  }

  // 収まりきらない名前は(実物のカードのように)まず横方向に圧縮し、
  // それでも読めないほど潰れる場合のみ末尾を省略する
  var NAME_MIN_HORIZONTAL_SCALE = 0.35;

  function drawNameBar(ctx, rect, card, lineWidth) {
    drawBoxFrame(ctx, rect, lineWidth, PAPER);

    var padding = rect.w * 0.02;
    ctx.fillStyle = INK;
    ctx.font = "bold " + Math.round(rect.h * 0.5) + "px 'Yu Gothic', 'Hiragino Kaku Gothic ProN', Meiryo, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    var diameter = rect.h * 0.56;
    var symbolSpacing = diameter * 1.2;
    var symbolAreaWidth =
      card.manaCost.length > 0 ? card.manaCost.length * symbolSpacing + padding : 0;
    var maxNameWidth = rect.w - padding * 2 - symbolAreaWidth;
    var name = card.name || "";
    var nameWidth = ctx.measureText(name).width;

    var scaleX = 1;
    if (nameWidth > maxNameWidth && nameWidth > 0) {
      scaleX = Math.max(maxNameWidth / nameWidth, NAME_MIN_HORIZONTAL_SCALE);
      if (scaleX === NAME_MIN_HORIZONTAL_SCALE) {
        // 最大圧縮率でもまだ収まらない場合は末尾を省略する
        while (name.length > 1 && ctx.measureText(name).width * scaleX > maxNameWidth) {
          name = name.substring(0, name.length - 1);
        }
        if (name.length > 1 && name !== (card.name || "")) {
          name = name.substring(0, name.length - 1) + "…";
        }
      }
    }

    var textX = rect.x + padding;
    var textY = rect.y + rect.h / 2;
    ctx.save();
    ctx.translate(textX, textY);
    ctx.scale(scaleX, 1);
    ctx.fillText(name, 0, 0);
    ctx.restore();

    var cx = rect.x + rect.w - padding - diameter / 2;
    var cy = rect.y + rect.h / 2;
    for (var i = card.manaCost.length - 1; i >= 0; i--) {
      drawManaSymbol(ctx, cx, cy, diameter, card.manaCost[i]);
      cx -= symbolSpacing;
    }
  }

  function drawArtBox(ctx, rect, card, lineWidth) {
    drawBoxFrame(ctx, rect, lineWidth, PAPER);

    if (card.artImage) {
      ctx.save();
      drawImageCover(ctx, card.artImage, rect.x, rect.y, rect.w, rect.h);
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTypeLine(ctx, rect, card, lineWidth, fontSizeOverride) {
    drawBoxFrame(ctx, rect, lineWidth, PAPER);

    var fontFamily = "'Yu Gothic', 'Hiragino Kaku Gothic ProN', Meiryo, Arial, sans-serif";
    var padding = rect.w * 0.02;
    var maxWidth = rect.w - padding * 2;
    var text = card.typeLine || "";
    var fontSize = fontSizeOverride || rect.h * 0.5;
    var minFontSize = fontSize * 0.4;

    while (fontSize > minFontSize) {
      ctx.font = "bold " + Math.round(fontSize) + "px " + fontFamily;
      if (ctx.measureText(text).width <= maxWidth) break;
      fontSize -= 1;
    }

    ctx.fillStyle = INK;
    ctx.font = "bold " + Math.round(fontSize) + "px " + fontFamily;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + padding, rect.y + rect.h / 2);
  }

  /** テキスト/シンボルのアトム行を左揃えで描画し、描画後のY座標を返す */
  function drawAtomLines(ctx, lines, startX, startY, lineHeight, fontSize, fontFamily, italic, bold) {
    var textFont = (italic ? "italic " : "") + (bold ? "bold " : "") + fontSize + "px " + fontFamily;
    var textY = startY;

    lines.forEach(function (line) {
      var atoms = line.atoms;
      var x = startX + (line.indent || 0);
      var cy = textY + lineHeight / 2;

      if (line.badge) {
        drawAbilityCostBadge(ctx, startX + line.badgeWidth / 2, cy, line.badgeWidth, fontSize * 1.15, line.badge, fontSize);
      }

      atoms.forEach(function (atom) {
        if (atom.type === "symbol") {
          var diameter = fontSize * 0.95;
          drawManaSymbol(ctx, x + diameter / 2, cy, diameter, codeToManaToken(atom.code));
          x += diameter + fontSize * 0.12;
        } else {
          ctx.font = textFont;
          ctx.fillStyle = INK;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(atom.value, x, cy);
          x += ctx.measureText(atom.value).width;
        }
      });

      textY += lineHeight;
    });

    return textY;
  }

  function drawRulesBox(ctx, rect, card, lineWidth, baseFontSizeOverride) {
    drawBoxFrame(ctx, rect, lineWidth, PAPER_TINT);

    var fontFamily = "'Yu Gothic', 'Hiragino Kaku Gothic ProN', Meiryo, Arial, sans-serif";
    var baseFontSize = baseFontSizeOverride || rect.h * 0.065;
    var fit = fitTextBlock(ctx, card, rect, baseFontSize, fontFamily);

    var textX = rect.x + fit.paddingX;

    drawAtomLines(
      ctx,
      fit.rulesLines,
      textX,
      rect.y + fit.paddingY,
      fit.lineHeight,
      fit.fontSize,
      fontFamily,
      false,
      true
    );

    // フレイバーテキストはボックスの底に固定する(ルールテキストが短くても下端に揃う)
    var flavorHeight = fit.flavorLines.length * fit.lineHeight;
    var flavorStartY = rect.y + rect.h - fit.paddingY - flavorHeight;
    drawAtomLines(ctx, fit.flavorLines, textX, flavorStartY, fit.lineHeight, fit.fontSize, fontFamily, true, false);

    return fit.fontSize;
  }

  function drawPTBox(ctx, rect, card, lineWidth) {
    drawCurvedBadge(ctx, statBoxPath, rect, lineWidth * 1.3);

    var label = (card.power || "0") + "/" + (card.toughness || "0");
    ctx.fillStyle = INK;
    ctx.font = "bold " + Math.round(rect.h * 0.72) + "px " + NUMBER_FONT_FAMILY;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  /** プレインズウォーカーの忠誠度ボックス(開始忠誠度の数字のみを表示) */
  function drawLoyaltyBox(ctx, rect, card, lineWidth) {
    drawCurvedBadge(ctx, loyaltyShieldPath, rect, lineWidth * 1.3);

    var label = card.loyalty || "0";
    ctx.fillStyle = INK;
    ctx.font = "bold " + Math.round(rect.h * 0.5) + "px " + NUMBER_FONT_FAMILY;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h * 0.55);
  }

  // 英雄譚の章番号(ローマ数字)。全角のローマ数字も受け付ける。
  var ROMAN_TOKEN = "(?:VIII|VII|VI|IV|IX|V|III|II|I|X|Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|Ⅶ|Ⅷ|Ⅸ|Ⅹ)";
  // 段落先頭の「I:」「II, III —」のような章の表記
  var SAGA_CHAPTER_PATTERN = new RegExp(
    "^\\s*(" + ROMAN_TOKEN + "(?:\\s*[,、，・]\\s*" + ROMAN_TOKEN + ")*)\\s*[:：—―\\-]\\s*"
  );
  var ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  var FULLWIDTH_ROMAN = "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ";

  function normalizeRoman(token) {
    var fw = FULLWIDTH_ROMAN.indexOf(token);
    return fw !== -1 ? ROMAN_NUMERALS[fw + 1] : token;
  }

  /**
   * 英雄譚のルールテキストを章ごとに分解する。章表記で始まる段落が新しい章になり、
   * 章表記のない段落は直前の章に続ける(最初の章より前の段落は前文として扱う)。
   */
  function parseSagaText(text) {
    var preamble = [];
    var chapters = [];
    String(text || "").split("\n").forEach(function (paragraph) {
      var match = paragraph.match(SAGA_CHAPTER_PATTERN);
      if (match) {
        var numerals = match[1].split(/\s*[,、，・]\s*/).map(normalizeRoman);
        chapters.push({ numerals: numerals, lines: [paragraph.slice(match[0].length)] });
      } else if (chapters.length) {
        chapters[chapters.length - 1].lines.push(paragraph);
      } else if (paragraph.trim() !== "") {
        preamble.push(paragraph);
      }
    });
    chapters.forEach(function (chapter) {
      chapter.text = chapter.lines.join("\n").replace(/\n+$/, "");
    });
    return { preamble: preamble.join("\n"), chapters: chapters };
  }

  /** 英雄譚の章番号バッジのパス(上下が尖った縦長の六角形) */
  function chapterBadgePath(ctx, rect) {
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    var cut = h * 0.22;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
  }

  function drawChapterBadge(ctx, rect, label) {
    chapterBadgePath(ctx, rect);
    ctx.fillStyle = INK;
    ctx.fill();

    var fontSize = rect.h * 0.5;
    var fontFamily = "'Times New Roman', Times, serif";
    ctx.font = "bold " + Math.round(fontSize) + "px " + fontFamily;
    var maxTextW = rect.w * 0.8;
    var textW = ctx.measureText(label).width;
    if (textW > maxTextW) {
      ctx.font = "bold " + Math.round(fontSize * (maxTextW / textW)) + "px " + fontFamily;
    }
    ctx.fillStyle = PAPER;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  /**
   * 英雄譚のテキスト列を描画する。先頭に注釈文(最終章の番号から自動生成)、
   * その下に章ごとの区画を罫線で区切って並べ、左端に章番号バッジを置く。
   * 余った高さは各章に均等に分配する。
   */
  function drawSagaRulesBox(ctx, rect, card, lineWidth) {
    drawBoxFrame(ctx, rect, lineWidth, PAPER_TINT);

    var fontFamily = "'Yu Gothic', 'Hiragino Kaku Gothic ProN', Meiryo, Arial, sans-serif";
    var saga = parseSagaText(card.rulesText);
    var lastChapter = 0;
    saga.chapters.forEach(function (chapter) {
      chapter.numerals.forEach(function (numeral) {
        lastChapter = Math.max(lastChapter, ROMAN_NUMERALS.indexOf(numeral));
      });
    });
    var reminder =
      "(この英雄譚が戦場に出た際とあなたのドロー・ステップの後に、伝承カウンター1個を加える。" +
      ROMAN_NUMERALS[lastChapter || 3] + "の後に、生け贄に捧げる。)";
    var headerText = reminder + (saga.preamble ? "\n" + saga.preamble : "");

    var paddingX = rect.w * 0.04;
    var paddingY = rect.h * 0.012;
    var badgeColumnW = rect.w * 0.18;
    var badgeW = badgeColumnW * 0.78;
    var badgeH = badgeW * 1.15;
    var badgeGap = badgeH * 0.25;
    var textX = rect.x + badgeColumnW + paddingX * 0.5;
    var chapterTextW = rect.x + rect.w - paddingX - textX;

    var fontSize = rect.w * 0.072;
    var minFontSize = fontSize * 0.45;
    var lineHeight, headerLines, headerH, groups, total;

    while (true) {
      lineHeight = fontSize * 1.18;
      headerLines = wrapRichText(ctx, headerText, rect.w - paddingX * 2, fontSize, fontFamily, false, false);
      headerH = headerLines.length * lineHeight + paddingY * 2;
      total = headerH;
      groups = saga.chapters.map(function (chapter) {
        var lines = wrapRichText(ctx, chapter.text, chapterTextW, fontSize, fontFamily, false, true);
        var n = chapter.numerals.length;
        var badgeStackH = n * badgeH + (n - 1) * badgeGap;
        var minH = Math.max(lines.length * lineHeight, badgeStackH) + paddingY * 4;
        total += minH;
        return { numerals: chapter.numerals, lines: lines, minH: minH, badgeStackH: badgeStackH };
      });
      if (total <= rect.h || fontSize <= minFontSize) break;
      fontSize -= 1;
    }

    drawAtomLines(ctx, toPlainLines(headerLines), rect.x + paddingX, rect.y + paddingY, lineHeight, fontSize, fontFamily, false, false);

    var extra = groups.length ? Math.max(0, rect.h - total) / groups.length : 0;
    var y = rect.y + headerH;
    groups.forEach(function (group) {
      var groupH = group.minH + extra;

      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = INK;
      ctx.stroke();

      var textStartY = y + (groupH - group.lines.length * lineHeight) / 2;
      drawAtomLines(ctx, toPlainLines(group.lines), textX, textStartY, lineHeight, fontSize, fontFamily, false, true);

      var badgeX = rect.x + (badgeColumnW - badgeW) / 2;
      var badgeY = y + (groupH - group.badgeStackH) / 2;
      if (group.numerals.length > 1) {
        // 複数章をまとめた場合はバッジ同士を縦線でつなぐ
        ctx.beginPath();
        ctx.moveTo(badgeX + badgeW / 2, badgeY + badgeH / 2);
        ctx.lineTo(badgeX + badgeW / 2, badgeY + group.badgeStackH - badgeH / 2);
        ctx.lineWidth = lineWidth * 1.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      group.numerals.forEach(function (numeral, idx) {
        drawChapterBadge(ctx, { x: badgeX, y: badgeY + idx * (badgeH + badgeGap), w: badgeW, h: badgeH }, numeral);
      });

      y += groupH;
    });

    return fontSize;
  }

  /** バトルの守備値バッジのパス(左右が尖った横長の六角形) */
  function defenseBadgePath(ctx, rect) {
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    var cut = w * 0.22;
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
  }

  function drawDefenseBox(ctx, rect, card, lineWidth) {
    drawCurvedBadge(ctx, defenseBadgePath, rect, lineWidth * 1.3);

    ctx.fillStyle = INK;
    ctx.font = "bold " + Math.round(rect.h * 0.62) + "px " + NUMBER_FONT_FAMILY;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.defense || "0", rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  /** カード本体をctxに描画する。width/heightに対して比率で描画する。 */
  function renderCard(ctx, width, height, card) {
    var lineWidth = Math.max(1, width * 0.004);
    var outerLineWidth = Math.max(1.5, width * 0.006);

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // バトルは横向きのカードなので、横長の座標系で描いてから反時計回りに
    // 90度回転させて縦長のキャンバスに収める(カードの上辺が左側に来る)
    if (card.isBattle) {
      ctx.translate(0, height);
      ctx.rotate(-Math.PI / 2);
      var portraitWidth = width;
      width = height;
      height = portraitWidth;
    }
    var layout = card.isBattle
      ? computeBattleLayout(width, height)
      : card.isSaga
        ? computeSagaLayout(width, height)
        : computeLayout(width, height);

    // クリップ半径は「枠線の半径+外側余白」と揃える(食い違うと枠線の角が
    // クリップで斜めに切り取られ、右上などに余分な線が見えてしまう)
    roundRectPath(ctx, 0, 0, width, height, layout.cornerRadius + layout.outerInset);
    ctx.clip();

    // 台紙全体を紙色で塗る
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);

    // 外枠線
    roundRectPath(
      ctx,
      layout.outerInset,
      layout.outerInset,
      width - layout.outerInset * 2,
      height - layout.outerInset * 2,
      layout.cornerRadius
    );
    ctx.lineWidth = outerLineWidth;
    ctx.strokeStyle = INK;
    ctx.stroke();

    drawNameBar(ctx, layout.nameBar, card, lineWidth);
    drawArtBox(ctx, layout.artBox, card, lineWidth);
    var rulesFontSize = card.isSaga && !card.isBattle
      ? drawSagaRulesBox(ctx, layout.rulesBox, card, lineWidth)
      : drawRulesBox(ctx, layout.rulesBox, card, lineWidth, layout.rulesBaseFontSize);
    drawTypeLine(ctx, layout.typeLine, card, lineWidth, rulesFontSize);

    if (card.isBattle) {
      drawDefenseBox(ctx, layout.defenseBox, card, lineWidth);
    } else if (card.isCreature) {
      drawPTBox(ctx, layout.ptBox, card, lineWidth);
    } else if (card.isPlaneswalker) {
      drawLoyaltyBox(ctx, layout.loyaltyBox, card, lineWidth);
    }

    ctx.restore();
  }

  window.CardMaker.cardRenderer = {
    roundRectPath: roundRectPath,
    computeLayout: computeLayout,
    parseSagaText: parseSagaText,
    drawImageCover: drawImageCover,
    wrapRichText: wrapRichText,
    fitTextBlock: fitTextBlock,
    drawManaSymbol: drawManaSymbol,
    renderCard: renderCard
  };
})();
