injectScript(chrome.runtime.getURL("content-scripts/utility.js"), "body");

let firstTime = true;

function chatIsActive() {
  let chatStatus = document.querySelector("cib-serp")?.getAttribute("mode");
  return chatStatus === "conversation";
}

function startsWithUser(messages) {
  return messages[0].getAttribute("source") == "user";
}

function getShadowElements(shadowRoot) {
  const fragment = new DocumentFragment();
  Array.from(shadowRoot.children).forEach((child) => {
    const clone = child.cloneNode(true);
    if (child.shadowRoot) {
      clone.appendChild(getShadowElements(child.shadowRoot));
    }
    fragment.appendChild(clone);
  });
  return fragment;
}

let id;
let chatLength = 0;
function saveConvo() {
  if (!chatIsActive()) {
    return;
  }
  
  // текущий диалог
  let convo = [];
  let chatDIV = document.querySelector("cib-serp")
    ?.shadowRoot.querySelector("#cib-conversation-main")
    ?.shadowRoot.querySelector("#cib-chat-main");
  
  if (!chatDIV) return;

  let c = getShadowElements(chatDIV);
  let messages = Array.from(c.querySelectorAll("cib-message-group"));

  if (messages.length > 0 && !startsWithUser(messages)) {
    messages.shift();
  }

  // замер длинны текста
  let textContentLength = messages.reduce((total, message) => {
    let content = message.querySelectorAll(".content");
    Array.from(content).forEach(each => total += each.innerText.trim().length);
    return total;
  }, 0);

  // сравнение всей длинны текста (вместо их кол-ва как в оригинале)
  if (textContentLength < chatLength) {
    firstTime = true;
    return;
  }
  chatLength = textContentLength;

  let firstUser = true;
  let title;
  for (let message of messages) {
    let source = message.getAttribute("source");
    if (source === "user") {
      let userMessages = message.querySelectorAll(".content");
      for (let each of userMessages) {
        let text = each.innerText;
        convo.push({ text: text, bot: false });
        if (firstUser) {
          title = text;
          firstUser = false;
        }
      }
    } else if (source === "bot") {
      let botMessages = message.querySelectorAll(".content");
      for (let each of botMessages) {
        let text = each?.querySelector(".ac-textBlock");
        if (text != null) {
          convo.push({ text: text.innerHTML, bot: true });
        }
      }
    }
  }
  if (firstTime) {
    id = generateUUID();
  }
  let thread = {
    convo: convo,
    title: title ?? document.title,
    date: getDate(),
    time: getTime(),
    id: id ?? generateUUID(),
    favorite: false,
    unified_id: false,
  };
  if (firstTime) {
    chrome.storage.local.get({ threads: [] }, function (result) {
      let t = result.threads;
      t.push(thread);
      chrome.storage.local.set({ threads: t });
    });
    firstTime = false;
  } else {
    chrome.storage.local.get({ threads: [] }, function (result) {
      let t = result.threads;
      t[t.length - 1] = thread;
      let threadIndex = getObjectIndexByID(id, t); // this is so user can modify storage whilst thread is saving
      if (threadIndex != null) {
        t[threadIndex] = thread;
        chrome.storage.local.set({ threads: t });
      }
    });
  }
}

const SAVE_INTERVAL = 1500; // ms (в оригинале - 3 сек)
setInterval(saveConvo, SAVE_INTERVAL);
