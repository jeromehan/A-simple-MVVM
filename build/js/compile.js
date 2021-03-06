"use strict";

var _getIterator2 = require("babel-runtime/core-js/get-iterator");

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _watcher = require("./watcher");

var _watcher2 = _interopRequireDefault(_watcher);

var _util = require("./util");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var dirRE = /^v-(.*)$/,
    eventRE = /^v-on:(.*)$/,
    tagRE = /\{\{\{(.*?)\}\}\}|\{\{(.*?)\}\}/g,
    htmlRE = /^\{\{\{(.*)\}\}\}$/,
    vhtml = "v-html",
    vtext = "v-text",
    vmodel = {
    INPUT: true,
    TEXTAREA: true
},
    cacheDiv = document.createElement("div");
// 更新集合
var updateCollection = {
    text: function text(ele, value) {
        ele.textContent = value == null ? "" : value;
    },
    html: function html(ele, value) {
        if (!ele.$parent) {
            ele.innerHTML = value;
        } else {
            // 解析插值html
            cacheDiv.innerHTML = value;
            var childs = cacheDiv.childNodes;
            var doms = [];
            var len = childs.length;
            var c;
            if (ele.$oneTime) {
                // 第一次更新
                while (len--) {
                    c = childs[0];
                    ele.appendChild(c);
                    doms.push(c);
                }
                ele.$doms = doms;
                ele.$oneTime = false;
            } else {
                var first = ele.$doms[0],
                    parent = first.parentNode;
                while (len--) {
                    c = childs[0];
                    (0, _util.insertBefore)(c, first);
                    doms.push(c);
                }
                ele.$doms.forEach(function (node) {
                    parent.removeChild(node);
                });
                ele.$doms = doms;
            }
        }
    },
    model: function model(ele, value, vm, path) {
        // 视图->模型，不用设置value值
        if (ele.value !== value) ele.value = value == null ? "" : value;
        // input事件不考虑ie9
        var flag = true;
        ele.addEventListener("compositionstart", function () {
            flag = false;
        }, false);
        ele.addEventListener("compositionend", function () {
            flag = true;
        }, false);
        ele.addEventListener("input", function (e) {
            if (!flag) return void 0;
            var newValue = e.target.value;
            if (value === newValue) {
                return void 0;
            }
            value = newValue;
            (0, _util.nextTick)(function () {
                (0, _util.setValue)(vm, path, newValue);
            });
        }, false);
    }
};
// 指定集合
var dirCollection = {
    text: function text(node, vm, path) {
        BaseDir(node, vm, path, "text");
    },
    html: function html(node, vm, path, parent) {
        BaseDir(node, vm, path, "html", parent);
    },
    model: function model(node, vm, path) {
        if (vmodel[node.tagName]) {
            BaseDir(node, vm, path, "model");
        } else {
            throw new Error("v-model just can use in input or textarea");
        }
    },
    eventDir: function eventDir(node, type, vm, fn) {
        var method = vm.$options.methods && vm.$options.methods[fn];
        if (method) {
            node.addEventListener(type, method.bind(vm), false);
        }
    }
};

function compile(el, vm) {
    el = el.cloneNode(true);
    compileNode(el, vm);
    return el;
}
function compileNode(node, vm) {
    var type = node.nodeType;
    if (type === 1 && !(0, _util.isScript)(node)) {
        compileElement(node, vm);
    } else if (type === 3 && node.data.trim()) {
        compileTextNode(node, vm);
    } else {
        return null;
    }
}
function compileNodeList(nodes, vm) {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(nodes), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var val = _step.value;

            compileNode(val, vm);
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
}
function compileElement(node, vm) {
    var flag = false;
    var attrs = Array.prototype.slice.call(node.attributes);
    attrs.forEach(function (val) {
        var name = val.name,
            value = val.value;
        if (dirRE.test(name)) {
            var dir;
            // 事件指令
            if ((dir = name.match(eventRE)) && (dir = dir[1])) {
                dirCollection["eventDir"](node, dir, vm, value);
            } else {
                dir = name.match(dirRE)[1];
                dirCollection[dir](node, vm, value);
            }
            // 指令中为v-html or v-text or v-model终止递归
            flag = flag || name === vhtml || name === vtext;
            node.removeAttribute(name);
        }
    });
    var childs = node.childNodes;
    if (!flag && childs && childs.length) {
        compileNodeList(childs, vm);
    }
}
function compileTextNode(node, vm) {
    var tokens = parseText(node);
    if (tokens == null) return void 0;
    var frag = document.createDocumentFragment();
    tokens.forEach(function (token) {
        var el;
        if (token.tag) {
            if (token.html) {
                el = document.createDocumentFragment();
                el.$parent = node.parentNode;
                el.$oneTime = true;
                dirCollection["html"](el, vm, token.value);
            } else {
                el = document.createTextNode(" ");
                dirCollection["text"](el, vm, token.value);
            }
        } else {
            el = document.createTextNode(token.value);
        }
        el && frag.appendChild(el);
    });
    return (0, _util.replace)(node, frag);
}
function parseText(node) {
    var text = node.wholeText;
    if (!tagRE.test(text)) {
        return void 0;
    }
    var tokens = [];
    var lastIndex = tagRE.lastIndex = 0,
        match,
        index,
        html,
        value;
    while (match = tagRE.exec(text)) {
        index = match.index;
        if (index > lastIndex) {
            tokens.push({
                value: text.slice(lastIndex, index)
            });
        }
        html = htmlRE.test(match[0]);
        value = html ? match[1] : match[2];
        tokens.push({
            value: value,
            tag: true,
            html: html
        });
        lastIndex = index + match[0].length;
    }
    if (lastIndex < text.length) {
        tokens.push({
            value: text.slice(lastIndex)
        });
    }
    return tokens;
}
function BaseDir(node, vm, path, dir, parent) {
    var fn = updateCollection[dir];
    fn && fn(node, (0, _util.getValue)(vm, path), vm, path);
    new _watcher2.default(vm, path, function (value) {
        fn && fn(node, value, vm, path);
    });
}
module.exports = compile;