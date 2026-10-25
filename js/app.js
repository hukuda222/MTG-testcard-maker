// フォーム連携、複数カードのデッキ管理、ライブプレビュー、PNG/PDFダウンロード処理
(function () {
  "use strict";

  var manaUtils = window.CardMaker.manaUtils;
  var cardRenderer = window.CardMaker.cardRenderer;
  var csvUtils = window.CardMaker.csvUtils;
  var pdfUtils = window.CardMaker.pdfUtils;

  var EXPORT_WIDTH = 1500;
  var EXPORT_HEIGHT = 2100;
  var PDF_CARD_WIDTH = 750;
  var PDF_CARD_HEIGHT = 1050;
  var DEBOUNCE_MS = 130;

  var form = document.getElementById("cardForm");
  var canvas = document.getElementById("cardCanvas");
  var ctx = canvas.getContext("2d");
  var ptFields = document.getElementById("ptFields");
  var loyaltyField = document.getElementById("loyaltyField");
  var defenseField = document.getElementById("defenseField");
  var downloadBtn = document.getElementById("downloadBtn");
  var downloadPdfBtn = document.getElementById("downloadPdfBtn");
  var artImageInput = document.getElementById("artImage");
  var artImageStatus = document.getElementById("artImageStatus");
  var artDropZone = document.getElementById("artDropZone");
  var artUrlInput = document.getElementById("artUrl");
  var artUrlBtn = document.getElementById("artUrlBtn");
  var clearArtBtn = document.getElementById("clearArtBtn");

  var csvInput = document.getElementById("csvInput");
  var csvUploadBtn = document.getElementById("csvUploadBtn");
  var csvFileStatus = document.getElementById("csvFileStatus");
  var downloadSampleCsvBtn = document.getElementById("downloadSampleCsvBtn");
  var downloadCsvBtn = document.getElementById("downloadCsvBtn");
  var addCardBtn = document.getElementById("addCardBtn");
  var deleteCardBtn = document.getElementById("deleteCardBtn");
  var deckList = document.getElementById("deckList");

  var debounceTimer = null;

  var MAX_TOTAL_CARDS = 99;

  /** 新規カードの初期値 */
  function defaultCardRaw() {
    return {
      name: "Card Name",
      manaCostString: "1G",
      cardTypes: ["ソーサリー"],
      typeSubtype: "",
      rulesText:
        "あなたのライブラリーの一番上にあるカード4枚を公開する。その中からパーマネント・カード1枚をあなたの手札に加えてもよい。残りをあなたの墓地に置く。「このクリーチャーを生け贄に捧げる:{C}を加える。」を持つ無色の0/1のエルドラージ・落とし子・クリーチャー・トークン1体を生成する。",
      flavorText: "",
      power: "",
      toughness: "",
      loyalty: "",
      defense: "",
      copies: 1,
      artImage: null,
      artObjectUrl: null,
      artFileName: ""
    };
  }

  /** 印刷枚数の入力値を1〜MAX_TOTAL_CARDSの整数に丸める */
  function sanitizeCopies(value) {
    var n = parseInt(value, 10);
    if (!isFinite(n) || n < 1) return 1;
    return n;
  }

  var cards = [defaultCardRaw()];
  var currentIndex = 0;

  function totalCardCount(excludeIndex) {
    return cards.reduce(function (total, card, index) {
      return total + (index === excludeIndex ? 0 : sanitizeCopies(card.copies));
    }, 0);
  }

  function maxCopiesForCurrentCard() {
    return Math.max(1, MAX_TOTAL_CARDS - totalCardCount(currentIndex));
  }

  /** フォームの現在値をcards[currentIndex]に書き戻す(画像関連は別管理) */
  function syncFormIntoCurrentCard() {
    var formData = new FormData(form);
    var card = cards[currentIndex];
    card.name = formData.get("name") || "";
    card.manaCostString = formData.get("manaCost") || "";
    card.cardTypes = formData.getAll("cardType");
    card.typeSubtype = (formData.get("typeSubtype") || "").trim();
    card.rulesText = formData.get("rulesText") || "";
    card.flavorText = formData.get("flavorText") || "";
    card.power = formData.get("power") || "";
    card.toughness = formData.get("toughness") || "";
    card.loyalty = formData.get("loyalty") || "";
    card.defense = formData.get("defense") || "";
    card.copies = Math.min(sanitizeCopies(form.elements.copies.value), maxCopiesForCurrentCard());
    form.elements.copies.value = card.copies;
  }

  /** cards配列上のデータモデルから、レンダラーが要求する形へ変換する */
  function computeDerivedCard(raw) {
    var isLegendary = raw.cardTypes.indexOf("伝説") !== -1;
    // 英雄譚はエンチャントのサブタイプなので、タイプ行では「エンチャント — 英雄譚」として表示する
    var isSaga = raw.cardTypes.indexOf("英雄譚") !== -1;
    var otherTypes = raw.cardTypes.filter(function (t) {
      return t !== "伝説" && t !== "英雄譚";
    });
    if (isSaga && otherTypes.indexOf("エンチャント") === -1) otherTypes.unshift("エンチャント");
    var subtypes = (isSaga ? ["英雄譚"] : []).concat(raw.typeSubtype ? [raw.typeSubtype] : []).join("・");
    var legendaryPrefix = isLegendary ? (otherTypes.length ? "伝説の" : "伝説") : "";
    var typeLine = legendaryPrefix + otherTypes.join("・") + (subtypes ? " — " + subtypes : "");
    return {
      name: raw.name,
      manaCostString: raw.manaCostString,
      manaCost: manaUtils.parseManaCost(raw.manaCostString),
      typeLine: typeLine,
      isCreature: raw.cardTypes.indexOf("クリーチャー") !== -1,
      isPlaneswalker: raw.cardTypes.indexOf("プレインズウォーカー") !== -1,
      isSaga: isSaga,
      isBattle: raw.cardTypes.indexOf("バトル") !== -1,
      rulesText: raw.rulesText,
      flavorText: raw.flavorText,
      power: raw.power,
      toughness: raw.toughness,
      loyalty: raw.loyalty,
      defense: raw.defense,
      artImage: raw.artImage
    };
  }

  /** cards[currentIndex]の内容をフォームに反映する */
  function populateFormFromCurrentCard() {
    var card = cards[currentIndex];
    form.elements["name"].value = card.name;
    form.elements["manaCost"].value = card.manaCostString;
    form.elements["typeSubtype"].value = card.typeSubtype;
    form.elements["rulesText"].value = card.rulesText;
    form.elements["flavorText"].value = card.flavorText;
    form.elements["power"].value = card.power;
    form.elements["toughness"].value = card.toughness;
    form.elements["loyalty"].value = card.loyalty;
    form.elements["defense"].value = card.defense || "";
    form.elements["copies"].value = card.copies;

    var typeCheckboxes = form.querySelectorAll('input[name="cardType"]');
    typeCheckboxes.forEach(function (checkbox) {
      checkbox.checked = card.cardTypes.indexOf(checkbox.value) !== -1;
    });

    artImageInput.value = "";
    updateArtImageStatus();
  }

  function updateArtImageStatus() {
    var card = cards[currentIndex];
    artImageStatus.textContent = card.artFileName ? "画像: " + card.artFileName : "画像: 未設定";
    if (card.artTainted) {
      artImageStatus.textContent += "（プレビューのみ。このサイトの画像はPNG/PDF出力できません。保存してファイル指定してください）";
    }
    clearArtBtn.style.display = card.artImage ? "inline" : "none";
  }

  function updateStatFieldsVisibility(card) {
    ptFields.style.display = card.isCreature ? "flex" : "none";
    loyaltyField.style.display = card.isPlaneswalker ? "block" : "none";
    defenseField.style.display = card.isBattle ? "block" : "none";
  }

  function renderPreview() {
    syncFormIntoCurrentCard();
    var derived = computeDerivedCard(cards[currentIndex]);
    updateStatFieldsVisibility(derived);
    cardRenderer.renderCard(ctx, canvas.width, canvas.height, derived);
    updateCurrentChipLabel();
  }

  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderPreview, DEBOUNCE_MS);
  }

  function sanitizeFilename(name) {
    var cleaned = String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return cleaned || "card";
  }

  // ---- デッキ一覧UI ----

  function chipLabel(card, index) {
    var label = (index + 1) + ". " + (card.name || "(名称未設定)");
    return card.copies > 1 ? label + " ×" + card.copies : label;
  }

  function updateCurrentChipLabel() {
    var chip = deckList.querySelector('[data-index="' + currentIndex + '"] .chip-name');
    if (chip) chip.textContent = chipLabel(cards[currentIndex], currentIndex);
  }

  function renderDeckList() {
    deckList.innerHTML = "";
    cards.forEach(function (card, index) {
      var li = document.createElement("li");

      var chip = document.createElement("div");
      chip.className = "deck-chip" + (index === currentIndex ? " selected" : "");
      chip.setAttribute("data-index", String(index));

      var nameSpan = document.createElement("span");
      nameSpan.className = "chip-name";
      nameSpan.textContent = chipLabel(card, index);
      chip.appendChild(nameSpan);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "chip-remove";
      removeBtn.textContent = "×";
      removeBtn.title = "このカードを削除";
      removeBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        removeCardAt(index);
      });
      chip.appendChild(removeBtn);

      chip.addEventListener("click", function () {
        goToCard(index);
      });

      li.appendChild(chip);
      deckList.appendChild(li);
    });
  }

  function goToCard(index) {
    if (index === currentIndex) return;
    syncFormIntoCurrentCard();
    currentIndex = index;
    populateFormFromCurrentCard();
    renderPreview();
    renderDeckList();
  }

  function removeCardAt(index) {
    var card = cards[index];
    if (card.artObjectUrl) URL.revokeObjectURL(card.artObjectUrl);
    cards.splice(index, 1);

    if (cards.length === 0) {
      cards.push(defaultCardRaw());
    }
    if (index < currentIndex) {
      currentIndex -= 1;
    }
    currentIndex = Math.max(0, Math.min(currentIndex, cards.length - 1));
    populateFormFromCurrentCard();
    renderPreview();
    renderDeckList();
  }

  function addCard() {
    syncFormIntoCurrentCard();
    if (totalCardCount() >= MAX_TOTAL_CARDS) return;
    cards.push(defaultCardRaw());
    currentIndex = cards.length - 1;
    populateFormFromCurrentCard();
    renderPreview();
    renderDeckList();
  }

  // ---- ダウンロード処理 ----

  function handleDownload() {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "生成中…";

    syncFormIntoCurrentCard();
    var derived = computeDerivedCard(cards[currentIndex]);
    var exportCanvas = document.createElement("canvas");
    exportCanvas.width = EXPORT_WIDTH;
    exportCanvas.height = EXPORT_HEIGHT;
    var exportCtx = exportCanvas.getContext("2d");
    cardRenderer.renderCard(exportCtx, EXPORT_WIDTH, EXPORT_HEIGHT, derived);

    if (cards[currentIndex].artTainted) {
      alert(TAINTED_EXPORT_MESSAGE);
      downloadBtn.disabled = false;
      downloadBtn.textContent = "このカードをPNGでダウンロード";
      return;
    }

    exportCanvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = sanitizeFilename(derived.name) + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);

      downloadBtn.disabled = false;
      downloadBtn.textContent = "このカードをPNGでダウンロード";
    }, "image/png");
  }

  function waitForFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(resolve);
    });
  }

  /** 何も印刷されていない、枠だけの空カード(印刷用紙の余りマスを埋める用) */
  function blankDerivedCard() {
    return {
      name: "",
      manaCostString: "",
      manaCost: [],
      typeLine: "",
      isCreature: false,
      isPlaneswalker: false,
      isSaga: false,
      isBattle: false,
      rulesText: "",
      flavorText: "",
      power: "",
      toughness: "",
      loyalty: "",
      defense: "",
      artImage: null
    };
  }

  var TAINTED_EXPORT_MESSAGE =
    "外部サイトから直接読み込んだ画像は、ブラウザの制限でPNG/PDFに出力できません。\n画像を右クリック→「名前を付けて画像を保存」し、ファイルとして指定し直してください。";

  async function handleDownloadPdf() {
    syncFormIntoCurrentCard();

    if (cards.some(function (c) { return c.artTainted; })) {
      alert(TAINTED_EXPORT_MESSAGE);
      return;
    }

    downloadPdfBtn.disabled = true;
    var exportCanvas = document.createElement("canvas");
    exportCanvas.width = PDF_CARD_WIDTH;
    exportCanvas.height = PDF_CARD_HEIGHT;
    var exportCtx = exportCanvas.getContext("2d");

    var dataUrls = [];
    try {
      for (var i = 0; i < cards.length; i++) {
        downloadPdfBtn.textContent = "PDF生成中… (" + (i + 1) + " / " + cards.length + ")";
        await waitForFrame();
        var derived = computeDerivedCard(cards[i]);
        cardRenderer.renderCard(exportCtx, PDF_CARD_WIDTH, PDF_CARD_HEIGHT, derived);
        var cardDataUrl = exportCanvas.toDataURL("image/png");
        var copies = sanitizeCopies(cards[i].copies);
        for (var c = 0; c < copies; c++) {
          dataUrls.push(cardDataUrl);
        }
      }

      // 最終ページが9枚に満たない場合、余りのマスは空カードで埋めて用紙を満たす
      var perPage = pdfUtils.computeGrid(pdfUtils.DEFAULT_CARD_WIDTH_MM, pdfUtils.DEFAULT_CARD_HEIGHT_MM).perPage;
      var remainder = dataUrls.length % perPage;
      if (remainder !== 0) {
        cardRenderer.renderCard(exportCtx, PDF_CARD_WIDTH, PDF_CARD_HEIGHT, blankDerivedCard());
        var blankDataUrl = exportCanvas.toDataURL("image/png");
        var padCount = perPage - remainder;
        for (var p = 0; p < padCount; p++) {
          dataUrls.push(blankDataUrl);
        }
      }

      downloadPdfBtn.textContent = "PDFに変換中…";
      await waitForFrame();
      var doc = pdfUtils.buildCardsPdf(dataUrls, {
        cardWidthMm: pdfUtils.DEFAULT_CARD_WIDTH_MM,
        cardHeightMm: pdfUtils.DEFAULT_CARD_HEIGHT_MM
      });

      var stamp = new Date();
      var pad = function (n) {
        return String(n).padStart(2, "0");
      };
      var filename =
        "cards_" + stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) + ".pdf";
      doc.save(filename);
    } catch (err) {
      alert("PDFの生成に失敗しました: " + err.message);
    } finally {
      downloadPdfBtn.disabled = false;
      downloadPdfBtn.textContent = "全カードをA4 PDFでダウンロード";
    }
  }

  // ---- 画像アップロード ----

  function handleArtImageChange(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    loadArtFromBlob(file, file.name);
  }

  function loadArtFromBlob(blob, name) {
    var card = cards[currentIndex];
    var objectUrl = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      if (card.artObjectUrl) URL.revokeObjectURL(card.artObjectUrl);
      card.artImage = img;
      card.artObjectUrl = objectUrl;
      card.artFileName = name || "貼り付け画像";
      card.artTainted = false;
      updateArtImageStatus();
      renderPreview();
    };
    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      alert("画像として読み込めませんでした。");
    };
    img.src = objectUrl;
  }

  // CSVの画像列(URL・base64)を対象カードに読み込む。失敗しても他のカードの読み込みは続ける
  function loadCsvArt(card) {
    var src = card.artSource;
    delete card.artSource;
    if (!src) return;
    src = normalizeBase64Image(src);
    fetch(src)
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.blob();
      })
      .then(function (blob) {
        var objectUrl = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          card.artImage = img;
          card.artObjectUrl = objectUrl;
          card.artFileName = /^data:/i.test(src) ? "CSV画像" : decodeURIComponent(src.split(/[?#]/)[0].split("/").pop() || "") || "CSV画像";
          card.artTainted = false;
          if (cards[currentIndex] === card) {
            updateArtImageStatus();
            renderPreview();
          }
          renderDeckList();
        };
        img.onerror = function () {
          URL.revokeObjectURL(objectUrl);
        };
        img.src = objectUrl;
      })
      .catch(function () {});
  }

  // Web上の画像をURLから取得する（CORSを許可しているサーバーのみ）。
  // blob: URLは発行元のページ内でしか有効でないため、他サイトのものは読めない。
  function loadArtFromUrl(url) {
    url = (url || "").trim();
    if (!url) return;
    url = normalizeBase64Image(url);
    if (/^data:/i.test(url)) {
      fetch(url)
        .then(function (res) {
          return res.blob();
        })
        .then(function (blob) {
          loadArtFromBlob(blob, "base64画像");
        })
        .catch(function () {
          alert("base64画像を読み込めませんでした。データが正しいか確認してください。");
        });
      return;
    }
    if (/^blob:/i.test(url) && url.indexOf("blob:" + location.origin) !== 0) {
      alert("他サイトの blob: URL は読み込めません。\n元のページで画像を右クリック →「画像をコピー」し、このページで Ctrl+V で貼り付けるか、画像をドラッグ&ドロップしてください。");
      return;
    }
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.blob();
      })
      .then(function (blob) {
        var name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "") || "Web画像";
        loadArtFromBlob(blob, name);
      })
      .catch(function () {
        loadArtDirect(url);
      });
  }

  // CORS非対応サーバーの画像は<img>で直接表示だけする。canvasが汚染されるため出力は不可。
  function loadArtDirect(url) {
    var card = cards[currentIndex];
    var img = new Image();
    img.onload = function () {
      if (card.artObjectUrl) URL.revokeObjectURL(card.artObjectUrl);
      card.artImage = img;
      card.artObjectUrl = null;
      card.artFileName = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "") || "Web画像";
      card.artTainted = true;
      updateArtImageStatus();
      renderPreview();
    };
    img.onerror = function () {
      alert("画像を取得できませんでした。\n画像をコピーして Ctrl+V で貼り付けるか、保存してファイル指定してください。");
    };
    img.src = url;
  }

  // "data:"の付いていない生のbase64文字列は、先頭のマジックナンバーから形式を推定してdata URLにする
  function normalizeBase64Image(text) {
    if (/^data:/i.test(text)) return text.replace(/\s+/g, "");
    var compact = text.replace(/\s+/g, "");
    if (compact.length < 32 || !/^[A-Za-z0-9+/]+=*$/.test(compact)) return text;
    var mime =
      compact.indexOf("iVBOR") === 0 ? "image/png" :
      compact.indexOf("/9j/") === 0 ? "image/jpeg" :
      compact.indexOf("R0lGOD") === 0 ? "image/gif" :
      compact.indexOf("UklGR") === 0 ? "image/webp" :
      compact.indexOf("PHN2Zy") === 0 || compact.indexOf("PD94bW") === 0 ? "image/svg+xml" :
      null;
    return mime ? "data:" + mime + ";base64," + compact : text;
  }

  function isImageText(text) {
    text = (text || "").trim();
    return /^(https?|blob|data):/i.test(text) || /^data:/.test(normalizeBase64Image(text));
  }

  function findImageFile(dataTransfer) {
    if (!dataTransfer) return null;
    var files = dataTransfer.files || [];
    for (var i = 0; i < files.length; i++) {
      if (/^image\//.test(files[i].type)) return files[i];
    }
    var items = dataTransfer.items || [];
    for (var j = 0; j < items.length; j++) {
      if (items[j].kind === "file" && /^image\//.test(items[j].type)) return items[j].getAsFile();
    }
    return null;
  }

  function handleArtPaste(event) {
    var target = event.target;
    var isTextField = target && (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && target.type !== "file"));
    var file = findImageFile(event.clipboardData);
    if (file) {
      event.preventDefault();
      loadArtFromBlob(file, file.name && file.name !== "image.png" ? file.name : "貼り付け画像");
      return;
    }
    if (target === artUrlInput) return;
    if (!isTextField) {
      var text = event.clipboardData && event.clipboardData.getData("text/plain");
      if (isImageText(text)) {
        event.preventDefault();
        loadArtFromUrl(text);
      }
    }
  }

  function handleArtDrop(event) {
    event.preventDefault();
    artDropZone.classList.remove("dragover");
    var file = findImageFile(event.dataTransfer);
    if (file) {
      loadArtFromBlob(file, file.name);
      return;
    }
    var url = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    if (url) loadArtFromUrl(url.split("\n")[0]);
  }

  function handleClearArt() {
    var card = cards[currentIndex];
    if (card.artObjectUrl) URL.revokeObjectURL(card.artObjectUrl);
    card.artImage = null;
    card.artObjectUrl = null;
    card.artFileName = "";
    card.artTainted = false;
    artImageInput.value = "";
    updateArtImageStatus();
    renderPreview();
  }

  // ---- CSVインポート ----

  var MAX_CSV_IMPORT_CARDS = Infinity;

  function handleCsvImport(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    csvFileStatus.textContent = file.name;

    var reader = new FileReader();
    reader.onload = function () {
      var imported;
      try {
        imported = csvUtils.cardsFromCsvText(String(reader.result || ""));
      } catch (err) {
        alert("CSVの解析に失敗しました: " + err.message);
        csvInput.value = "";
        return;
      }

      if (imported.length === 0) {
        alert("読み込めるカードが見つかりませんでした。ヘッダー行と列名を確認してください。");
        csvInput.value = "";
        return;
      }

      if (imported.length > MAX_CSV_IMPORT_CARDS) {
        alert(
          "一度に読み込めるカードは" + MAX_CSV_IMPORT_CARDS + "種類までです。" +
          "CSVには" + imported.length + "件ありましたが、最初の" + MAX_CSV_IMPORT_CARDS + "種類のみ読み込みます。"
        );
        imported = imported.slice(0, MAX_CSV_IMPORT_CARDS);
      }

      syncFormIntoCurrentCard();
      var remaining = MAX_TOTAL_CARDS - totalCardCount();
      var accepted = [];
      imported.forEach(function (card) {
        if (remaining <= 0) return;
        card.copies = Math.min(sanitizeCopies(card.copies), remaining);
        accepted.push(card);
        remaining -= card.copies;
      });
      if (accepted.length === 0) return;
      var firstNewIndex = cards.length;
      cards = cards.concat(accepted);
      currentIndex = firstNewIndex;
      populateFormFromCurrentCard();
      renderPreview();
      renderDeckList();
      accepted.forEach(loadCsvArt);
      csvInput.value = "";
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleDownloadCsv() {
    syncFormIntoCurrentCard();
    var csvText = csvUtils.cardsToCsvText(cards);
    var blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "cards.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function handleDownloadSampleCsv() {
    var csvText = csvUtils.generateSampleCsvText();
    var blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "sample_cards.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  form.addEventListener("input", scheduleRender);
  artImageInput.addEventListener("change", handleArtImageChange);
  document.addEventListener("paste", handleArtPaste);
  artDropZone.addEventListener("dragover", function (event) {
    event.preventDefault();
    artDropZone.classList.add("dragover");
  });
  artDropZone.addEventListener("dragleave", function () {
    artDropZone.classList.remove("dragover");
  });
  artDropZone.addEventListener("drop", handleArtDrop);
  artUrlBtn.addEventListener("click", function () {
    loadArtFromUrl(artUrlInput.value);
  });
  artUrlInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      loadArtFromUrl(artUrlInput.value);
    }
  });
  clearArtBtn.addEventListener("click", handleClearArt);
  downloadBtn.addEventListener("click", handleDownload);
  downloadPdfBtn.addEventListener("click", handleDownloadPdf);

  csvInput.addEventListener("change", handleCsvImport);
  csvUploadBtn.addEventListener("click", function () {
    csvInput.click();
  });
  downloadSampleCsvBtn.addEventListener("click", handleDownloadSampleCsv);
  downloadCsvBtn.addEventListener("click", handleDownloadCsv);
  addCardBtn.addEventListener("click", addCard);
  deleteCardBtn.addEventListener("click", function () {
    removeCardAt(currentIndex);
  });

  populateFormFromCurrentCard();
  renderPreview();
  renderDeckList();
})();
