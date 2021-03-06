/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde

 ---

 Originally based on Rikaikun 0.8
 Copyright (C) 2010 Erek Speed
 http://code.google.com/p/rikaikun/

 ---

 Originally based on Rikaichan 1.07
 by Jonathan Zarate
 http://www.polarcloud.com/

 ---

 Originally based on RikaiXUL 0.4 by Todd Rudick
 http://www.rikai.com/
 http://rikaixul.mozdev.org/

 ---

 This program is free software; you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 2 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

 ---

 Please do not change or remove any of the copyrights or links to web pages
 when modifying any of the files.

 */

'use strict';

import { ZhongwenDictionary } from './dict.js';

let isEnabled = localStorage['enabled'] === '1';

let tabIDs = {};

let dict;

let zhongwenOptions = window.zhongwenOptions = {
    css: localStorage['popupcolor'] || 'yellow',
    tonecolors: localStorage['tonecolors'] || 'yes',
    fontSize: localStorage['fontSize'] || 'small',
    skritterTLD: localStorage['skritterTLD'] || 'com',
    zhuyin: localStorage['zhuyin'] || 'no',
    grammar: localStorage['grammar'] || 'yes',
    simpTrad: localStorage['simpTrad'] || 'classic',
    toneColorScheme: localStorage['toneColorScheme'] || 'standard'
};

let activatedTabs = new Set();

function activateExtension(tabId, showHelp) {
    isEnabled = true;
    // values in localStorage are always strings
    localStorage['enabled'] = '1';

    if (!dict) {
        loadDictionary().then(r => dict = r);
    }

    const enableMsg = {
        'type': 'enable',
        'config': zhongwenOptions
    };

    let enablePromise;
    if (activatedTabs.has(tabId) === false) {
        enablePromise = loadScripts(tabId).then(() => {
            activatedTabs.add(tabId);
            return browser.tabs.sendMessage(tabId, enableMsg);
        });
    } else {
        enablePromise = browser.tabs.sendMessage(tabId, enableMsg);
    }
    enablePromise.catch(error => console.error(`${error}`));

    if (showHelp) {
        enablePromise.then(() => {
            return browser.tabs.sendMessage(tabId, {
                'type': 'showHelp'
            });
        });
    }

    chrome.browserAction.setBadgeBackgroundColor({
        'color': [255, 0, 0, 255]
    });

    chrome.browserAction.setBadgeText({
        'text': 'On'
    });

    chrome.contextMenus.create(
        {
            title: 'Open word list',
            onclick: function () {
                let url = chrome.runtime.getURL('/wordlist.html');
                let tabID = tabIDs['wordlist'];
                if (tabID) {
                    chrome.tabs.get(tabID, function (tab) {
                        if (tab && tab.url && (tab.url.substr(-13) === 'wordlist.html')) {
                            chrome.tabs.reload(tabID);
                            chrome.tabs.update(tabID, {
                                active: true
                            });
                        } else {
                            chrome.tabs.create({
                                url: url
                            }, function (tab) {
                                tabIDs['wordlist'] = tab.id;
                                chrome.tabs.reload(tab.id);
                            });
                        }
                    });
                } else {
                    chrome.tabs.create(
                        { url: url },
                        function (tab) {
                            tabIDs['wordlist'] = tab.id;
                            chrome.tabs.reload(tab.id);
                        }
                    );
                }
            }
        }
    );
    chrome.contextMenus.create(
        {
            title: 'Show help in new tab',
            onclick: function () {
                let url = chrome.runtime.getURL('/help.html');
                let tabID = tabIDs['help'];
                if (tabID) {
                    chrome.tabs.get(tabID, function (tab) {
                        if (tab && (tab.url.substr(-9) === 'help.html')) {
                            chrome.tabs.reload(tabID);
                            chrome.tabs.update(tabID, {
                                active: true
                            });
                        } else {
                            chrome.tabs.create({
                                url: url
                            }, function (tab) {
                                tabIDs['help'] = tab.id;
                                chrome.tabs.reload(tab.id);
                            });
                        }
                    });
                } else {
                    chrome.tabs.create(
                        { url: url },
                        function (tab) {
                            tabIDs['help'] = tab.id;
                            chrome.tabs.reload(tab.id);
                        }
                    );
                }
            }
        }
    );
}

async function loadDictData() {
    let wordDict = fetch(chrome.runtime.getURL(
        "data/cedict_ts.u8")).then(r => r.text());
    let wordIndex = fetch(chrome.runtime.getURL(
        "data/cedict.idx")).then(r => r.text());
    let grammarKeywords = fetch(chrome.runtime.getURL(
        "data/grammarKeywordsMin.json")).then(r => r.json());

    return Promise.all([wordDict, wordIndex, grammarKeywords]);
}


async function loadDictionary() {
    let [wordDict, wordIndex, grammarKeywords] = await loadDictData();
    return new ZhongwenDictionary(wordDict, wordIndex, grammarKeywords);
}

function deactivateExtension(tabId) {

    isEnabled = false;
    // values in localStorage are always strings
    localStorage['enabled'] = '0';

    dict = undefined;

    chrome.browserAction.setBadgeBackgroundColor({
        'color': [0, 0, 0, 0]
    });

    chrome.browserAction.setBadgeText({
        'text': ''
    });

    if (activatedTabs.has(tabId) === true) {
        browser.tabs.sendMessage(tabId, {
            'type': 'disable'
        }).catch(error => console.error(`${error}`));
    }

    chrome.contextMenus.removeAll();
}

function loadScripts(tabId) {
    return browser.tabs.executeScript(tabId, {
        allFrames: true,
        file: "/js/jquery-3.3.1.min.js",
    }).then(() => {
        return browser.tabs.executeScript(tabId, {
            allFrames: true,
            file: "/js/zhuyin.js",
        });
    }).then(() => {
        return browser.tabs.executeScript(tabId, {
            allFrames: true,
            file: "/content.js",
        });
    }).then(() => {
        return browser.tabs.insertCSS(tabId, {
            allFrames: true,
            file: "/css/content.css",
        });
    }).catch(error => {
        console.error(`${error}`);
    }).finally(() => {
        // always returns success whether scripts are loaded or not
        return Promise.resolve();
    });
}

function activateExtensionToggle(currentTab) {
    if (isEnabled) {
        deactivateExtension(currentTab.id);
    } else {
        activateExtension(currentTab.id, true);
    }
}

function enableTab(tabId) {
    if (isEnabled) {
        activateExtension(tabId, false);
    } else {
        deactivateExtension(tabId);
    }
}

function search(text) {

    if (!dict) {
        // dictionary not loaded
        return;
    }

    let entry = dict.wordSearch(text);

    if (entry) {
        for (let i = 0; i < entry.data.length; i++) {
            let word = entry.data[i][1];
            if (dict.hasKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.grammar = { keyword: word, index: i };
            }
        }
    }

    return entry;
}

chrome.browserAction.onClicked.addListener(activateExtensionToggle);

chrome.tabs.onActivated.addListener(activeInfo => enableTab(activeInfo.tabId));
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    if (changeInfo.status === 'complete') {
        enableTab(tabId);
    }
});

chrome.runtime.onMessage.addListener(function (request, sender, callback) {

    let tabID;

    switch (request.type) {

        case 'search': {
            let response = search(request.text);
            response.originalText = request.originalText;
            callback(response);
        }
            break;

        case 'open':
            tabID = tabIDs[request.tabType];
            if (tabID) {
                chrome.tabs.get(tabID, function (tab) {
                    if (chrome.runtime.lastError) {
                        tab = undefined;
                    }
                    if (tab && tab.url && (tab.url.substr(-13) === 'wordlist.html')) {
                        // open existing word list
                        chrome.tabs.update(tabID, {
                            active: true
                        });
                    } else {
                        chrome.tabs.create({
                            url: request.url
                        }, function (tab) {
                            tabIDs[request.tabType] = tab.id;
                        });
                    }
                });
            } else {
                chrome.tabs.create({
                    url: request.url
                }, function (tab) {
                    tabIDs[request.tabType] = tab.id;
                    if (request.tabType === 'wordlist') {
                        // make sure the table is sized correctly
                        chrome.tabs.reload(tab.id);
                    }
                });
            }
            break;

        case 'copy': {
            let txt = document.createElement('textarea');
            txt.style.position = "absolute";
            txt.style.left = "-100%";
            txt.value = request.data;
            document.body.appendChild(txt);
            txt.select();
            document.execCommand('copy');
            document.body.removeChild(txt);
        }
            break;

        case 'add': {
            let json = localStorage['wordlist'];

            let saveFirstEntryOnly = localStorage['saveToWordList'] === 'firstEntryOnly';

            let wordlist;
            if (json) {
                wordlist = JSON.parse(json);
            } else {
                wordlist = [];
            }

            for (let i in request.entries) {

                let entry = {};
                entry.timestamp = Date.now();
                entry.simplified = request.entries[i].simplified;
                entry.traditional = request.entries[i].traditional;
                entry.pinyin = request.entries[i].pinyin;
                entry.definition = request.entries[i].definition;

                wordlist.push(entry);

                if (saveFirstEntryOnly) {
                    break;
                }
            }
            localStorage['wordlist'] = JSON.stringify(wordlist);

            tabID = tabIDs['wordlist'];
            if (tabID) {
                chrome.tabs.get(tabID, function (tab) {
                    if (tab) {
                        chrome.tabs.reload(tabID);
                    }
                });
            }
        }
            break;

        default:
        // ignore
    }
});
