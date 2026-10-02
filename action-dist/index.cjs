"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports2) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports2.ALIAS = ALIAS;
    exports2.DOC = DOC;
    exports2.MAP = MAP;
    exports2.NODE_TYPE = NODE_TYPE;
    exports2.PAIR = PAIR;
    exports2.SCALAR = SCALAR;
    exports2.SEQ = SEQ;
    exports2.hasAnchor = hasAnchor;
    exports2.isAlias = isAlias;
    exports2.isCollection = isCollection;
    exports2.isDocument = isDocument;
    exports2.isMap = isMap;
    exports2.isNode = isNode;
    exports2.isPair = isPair;
    exports2.isScalar = isScalar;
    exports2.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports2.visit = visit;
    exports2.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports2.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports2.anchorIsValid = anchorIsValid;
    exports2.anchorNames = anchorNames;
    exports2.createNodeAnchors = createNodeAnchors;
    exports2.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports2) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports2.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports2.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports2) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports2.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports2.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports2.Scalar = Scalar;
    exports2.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports2.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports2.Collection = Collection;
    exports2.collectionFromPath = collectionFromPath;
    exports2.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports2) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports2.indentComment = indentComment;
    exports2.lineComment = lineComment;
    exports2.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports2) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports2.FOLD_BLOCK = FOLD_BLOCK;
    exports2.FOLD_FLOW = FOLD_FLOW;
    exports2.FOLD_QUOTED = FOLD_QUOTED;
    exports2.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports2.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports2.createStringifyContext = createStringifyContext;
    exports2.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports2.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports2) {
    "use strict";
    var node_process = require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning2) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning2);
        else
          console.warn(warning2);
      }
    }
    exports2.debug = debug;
    exports2.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports2.addMergeToJSMap = addMergeToJSMap;
    exports2.isMergeKey = isMergeKey;
    exports2.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports2) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports2.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports2.Pair = Pair;
    exports2.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports2.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports2) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports2.YAMLMap = YAMLMap;
    exports2.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports2.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports2.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports2.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports2) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports2.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports2.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports2.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports2) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports2.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports2) {
    "use strict";
    var node_buffer = require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports2.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports2.createPairs = createPairs;
    exports2.pairs = pairs;
    exports2.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports2.YAMLOMap = YAMLOMap;
    exports2.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports2.falseTag = falseTag;
    exports2.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intBin = intBin;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports2.YAMLSet = YAMLSet;
    exports2.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports2.floatTime = floatTime;
    exports2.intTime = intTime;
    exports2.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports2.coreKnownTags = coreKnownTags;
    exports2.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports2.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports2.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports2.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports2) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports2.YAMLError = YAMLError;
    exports2.YAMLParseError = YAMLParseError;
    exports2.YAMLWarning = YAMLWarning;
    exports2.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports2) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports2.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports2) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports2.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports2) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports2.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports2.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports2) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports2.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports2) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports2.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports2) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports2.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports2.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports2.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports2.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + lm;
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports2.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports2.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports2) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports2.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports2.composeEmptyNode = composeEmptyNode;
    exports2.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports2) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports2.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning2) => {
          const pos = getErrorPos(source);
          if (warning2)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning2) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning2);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports2.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports2) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports2.createScalarToken = createScalarToken;
    exports2.resolveAsScalar = resolveAsScalar;
    exports2.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports2) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports2.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports2) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports2.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports2) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports2.createScalarToken = cstScalar.createScalarToken;
    exports2.resolveAsScalar = cstScalar.resolveAsScalar;
    exports2.setScalarValue = cstScalar.setScalarValue;
    exports2.stringify = cstStringify.stringify;
    exports2.visit = cstVisit.visit;
    exports2.BOM = BOM;
    exports2.DOCUMENT = DOCUMENT;
    exports2.FLOW_END = FLOW_END;
    exports2.SCALAR = SCALAR;
    exports2.isCollection = isCollection;
    exports2.isScalar = isScalar;
    exports2.prettyToken = prettyToken;
    exports2.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports2) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports2.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports2) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports2.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports2.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument2(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse3(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument2(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning2) => log.warn(doc.options.logLevel, warning2));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports2.parse = parse3;
    exports2.parseAllDocuments = parseAllDocuments;
    exports2.parseDocument = parseDocument2;
    exports2.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports2.Composer = composer.Composer;
    exports2.Document = Document.Document;
    exports2.Schema = Schema.Schema;
    exports2.YAMLError = errors.YAMLError;
    exports2.YAMLParseError = errors.YAMLParseError;
    exports2.YAMLWarning = errors.YAMLWarning;
    exports2.Alias = Alias.Alias;
    exports2.isAlias = identity.isAlias;
    exports2.isCollection = identity.isCollection;
    exports2.isDocument = identity.isDocument;
    exports2.isMap = identity.isMap;
    exports2.isNode = identity.isNode;
    exports2.isPair = identity.isPair;
    exports2.isScalar = identity.isScalar;
    exports2.isSeq = identity.isSeq;
    exports2.Pair = Pair.Pair;
    exports2.Scalar = Scalar.Scalar;
    exports2.YAMLMap = YAMLMap.YAMLMap;
    exports2.YAMLSeq = YAMLSeq.YAMLSeq;
    exports2.CST = cst;
    exports2.Lexer = lexer.Lexer;
    exports2.LineCounter = lineCounter.LineCounter;
    exports2.Parser = parser.Parser;
    exports2.parse = publicApi.parse;
    exports2.parseAllDocuments = publicApi.parseAllDocuments;
    exports2.parseDocument = publicApi.parseDocument;
    exports2.stringify = publicApi.stringify;
    exports2.visit = visit.visit;
    exports2.visitAsync = visit.visitAsync;
  }
});

// src/action.ts
var import_promises = require("node:fs/promises");
var import_node_path2 = require("node:path");

// src/action-input.ts
function actionInputEnvName(name) {
  return `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
}
function actionInput(name, env = process.env) {
  return env[actionInputEnvName(name)]?.trim() ?? "";
}
function intActionInput(name, fallback, min, max, env = process.env) {
  const raw = actionInput(name, env);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}
function boolActionInput(name, fallback, env = process.env) {
  const raw = actionInput(name, env).toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  throw new Error(`${name} must be true or false`);
}

// src/action-report.ts
var percent = (value) => value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
var seconds = (value) => value === null ? "n/a" : `${value.toFixed(1)}s`;
var dollars = (value, digits = 3) => value === null ? "n/a" : `$${value.toFixed(digits)}`;
function formatActionReport(repository, workflow, recommendation, backtest, backtestError) {
  const selected = recommendation.selectedCells.map(
    (cell) => `- \`${cell.cell}\` \u2014 failures=${cell.coveredFailures}, combinations=${cell.coveredCombinations}, median=${seconds(cell.medianRuntimeSeconds)}, list-price/run=${dollars(cell.estimatedListPriceUsdPerRun)}`
  ).join("\n");
  const historical = recommendation.historicalRecall === null ? "n/a (no analyzed failure fingerprints)" : `${recommendation.coveredFingerprints}/${recommendation.historicalFingerprints} (${percent(recommendation.historicalRecall)})`;
  const combinatorial = recommendation.combinatorialCoverage === null ? "n/a" : `${recommendation.coveredCombinatorialRequirements}/${recommendation.combinatorialRequirements} (${percent(recommendation.combinatorialCoverage)})`;
  const reduction = recommendation.estimatedComputeReductionPercent === null ? "n/a" : `${recommendation.estimatedComputeReductionPercent.toFixed(1)}%`;
  const listPricePerRun = recommendation.currentEstimatedListPriceUsdPerRun === null || recommendation.selectedEstimatedListPriceUsdPerRun === null ? "n/a" : `${dollars(recommendation.currentEstimatedListPriceUsdPerRun)} \u2192 ${dollars(recommendation.selectedEstimatedListPriceUsdPerRun)}`;
  const listPriceReduction = recommendation.estimatedListPriceReductionPercent === null ? "n/a" : `${recommendation.estimatedListPriceReductionPercent.toFixed(1)}%`;
  const projected30d = recommendation.currentProjectedListPriceUsd30Days === null || recommendation.selectedProjectedListPriceUsd30Days === null || recommendation.projectedRunsPer30Days === null ? "n/a" : `${dollars(recommendation.currentProjectedListPriceUsd30Days, 2)} \u2192 ${dollars(recommendation.selectedProjectedListPriceUsd30Days, 2)} (${recommendation.projectedRunsPer30Days.toFixed(1)} runs)`;
  const estimatedChargePerRun = recommendation.pricing.currentEstimatedChargeUsdPerRun === null || recommendation.pricing.selectedEstimatedChargeUsdPerRun === null ? "n/a" : `${dollars(recommendation.pricing.currentEstimatedChargeUsdPerRun)} \u2192 ${dollars(recommendation.pricing.selectedEstimatedChargeUsdPerRun)}`;
  const estimatedChargeReduction = recommendation.pricing.estimatedChargeReductionPercent === null ? "n/a" : `${recommendation.pricing.estimatedChargeReductionPercent.toFixed(1)}%`;
  const projectedCharge30d = recommendation.pricing.currentEstimatedChargeUsdPer30Days === null || recommendation.pricing.selectedEstimatedChargeUsdPer30Days === null || recommendation.pricing.projectedRunsPer30Days === null ? "n/a" : `${dollars(recommendation.pricing.currentEstimatedChargeUsdPer30Days, 2)} \u2192 ${dollars(recommendation.pricing.selectedEstimatedChargeUsdPer30Days, 2)} (${recommendation.pricing.projectedRunsPer30Days.toFixed(1)} runs)`;
  const repositoryVisibility = recommendation.pricing.repositoryVisibility ?? "unknown";
  const backtestRows = backtest ? [
    `| Holdout optimizer | ${backtest.optimizerAlgorithm} (optimal=${backtest.optimizerOptimal ?? "n/a"}, nodes=${backtest.optimizerSearchNodes}) |`,
    `| Holdout failure recall | ${backtest.coveredHoldoutFingerprints}/${backtest.holdoutFingerprints} (${percent(backtest.holdoutRecall)}) |`,
    `| Unseen-failure recall | ${backtest.unseenHoldoutRecall === null ? "n/a" : `${backtest.coveredUnseenHoldoutFingerprints}/${backtest.unseenHoldoutFingerprints} (${percent(backtest.unseenHoldoutRecall)})`} |`,
    `| Holdout combinatorial coverage | ${backtest.holdoutCombinatorialCoverage === null ? "n/a" : `${backtest.coveredHoldoutCombinatorialRequirements}/${backtest.holdoutCombinatorialRequirements} (${percent(backtest.holdoutCombinatorialCoverage)})`} |`
  ].join("\n") : `| Backtest | unavailable${backtestError ? `: ${backtestError}` : ""} |`;
  const warnings = recommendation.warnings.map((warning2) => `- \u26A0\uFE0F ${warning2}`).join("\n");
  return `<!-- matrixtrim-report -->
## MatrixTrim analysis

**Repository:** \`${repository}\`<br>
**Workflow:** \`${workflow ?? "all"}\`<br>
**Coverage strength:** ${recommendation.coverageStrength}

| Metric | Result |
| --- | ---: |
| Current matrix cells | ${recommendation.currentCells} |
| Suggested cells | ${recommendation.selectedCells.length} |
| Optimizer | ${recommendation.algorithm} (mode=${recommendation.optimizerMode}, optimal=${recommendation.optimizerOptimal ?? "n/a"}, nodes=${recommendation.optimizerSearchNodes}) |
| Optimizer improvement vs greedy | ${recommendation.optimizerImprovementPercent.toFixed(1)}% |
| Historical failure recall | ${historical} |
| Failure events | ${recommendation.failureEvents} |
| Failed jobs with events | ${recommendation.failedJobsWithEvents} |
| Multi-event jobs | ${recommendation.multiEventJobs} |
| Observed combinatorial coverage | ${combinatorial} |
| Explicit hard constraints | ${recommendation.coveredConstraintRequirements}/${recommendation.constraintRequirements} |
| Estimated compute | ${seconds(recommendation.currentEstimatedSeconds)} \u2192 ${seconds(recommendation.selectedEstimatedSeconds)} |
| Estimated compute reduction | ${reduction} |
| Pricing coverage | ${percent(recommendation.pricingCoverage)} |
| Repository visibility | ${repositoryVisibility} |
| Standard runner rate-card / run | ${listPricePerRun} |
| Rate-card reduction | ${listPriceReduction} |
| Projected 30-day rate-card equivalent | ${projected30d} |
| Estimated GitHub charge / run | ${estimatedChargePerRun} |
| Estimated GitHub charge reduction | ${estimatedChargeReduction} |
| Projected 30-day GitHub charge | ${projectedCharge30d} |
${backtestRows}

<details>
<summary>Suggested cells</summary>

${selected || "_No cells selected._"}

</details>

### Interpretation

MatrixTrim measures the historical failure-detection value of CI configurations. A recommendation is **evidence, not proof that removed configurations can never catch a future failure**.

**Billing note:** ${recommendation.pricing.note}

${warnings}

_Generated by MatrixTrim._
`;
}

// src/axes.ts
var import_yaml = __toESM(require_dist(), 1);

// src/expression.ts
function expressionNumber(value) {
  if (value === null) return 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    if (!value.trim()) return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  }
  return Number.NaN;
}
function expressionEqual(a, b) {
  if (typeof a === typeof b) {
    if (typeof a === "string" && typeof b === "string") {
      return a.toLowerCase() === b.toLowerCase();
    }
    if (typeof a === "object" && a !== null || Array.isArray(a)) {
      return a === b;
    }
    return Object.is(a, b);
  }
  const left = expressionNumber(a);
  const right = expressionNumber(b);
  return !Number.isNaN(left) && !Number.isNaN(right) && left === right;
}
function expressionCompare(a, b, operator) {
  if (typeof a === "string" && typeof b === "string") {
    const left2 = a.toLowerCase();
    const right2 = b.toLowerCase();
    if (operator === "<") return left2 < right2;
    if (operator === "<=") return left2 <= right2;
    if (operator === ">") return left2 > right2;
    return left2 >= right2;
  }
  const left = expressionNumber(a);
  const right = expressionNumber(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  if (operator === "<") return left < right;
  if (operator === "<=") return left <= right;
  if (operator === ">") return left > right;
  return left >= right;
}
function githubString(value) {
  if (value === null) return "";
  if (["string", "number", "boolean"].includes(typeof value)) {
    return String(value);
  }
  return void 0;
}
function getPath(row, path) {
  const parts = path.split(".");
  function descend(value, index) {
    if (index >= parts.length) return value;
    const part = parts[index];
    if (part === "*") {
      if (!Array.isArray(value)) return void 0;
      return value.flatMap((item) => {
        const resolved = descend(item, index + 1);
        return Array.isArray(resolved) ? resolved : [resolved];
      }).filter((item) => item !== void 0);
    }
    if (!value || typeof value !== "object") return null;
    const record = value;
    if (!(part in record)) return null;
    return descend(record[part], index + 1);
  }
  return descend(row, 0);
}
function splitArgs(text) {
  const result = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === quote && text[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      result.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(text.slice(start).trim());
  return result;
}
function hasWrappingParentheses(text) {
  if (!text.startsWith("(") || !text.endsWith(")")) return false;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === quote && text[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth === 0 && index < text.length - 1) return false;
  }
  return depth === 0;
}
function evalExpression(expression, row) {
  let expr = expression.trim();
  while (hasWrappingParentheses(expr)) {
    expr = expr.slice(1, -1).trim();
  }
  const fallback = splitTopLevel(expr, "||");
  if (fallback.length > 1) {
    let last = "";
    for (const part of fallback) {
      const value = evalExpression(part, row);
      last = value;
      if (value) return value;
    }
    return last;
  }
  const andParts = splitTopLevel(expr, "&&");
  if (andParts.length > 1) {
    let last = true;
    for (const part of andParts) {
      const value = evalExpression(part, row);
      last = value;
      if (!value) return value;
    }
    return last;
  }
  for (const operator of ["<=", ">=", "<", ">"]) {
    const comparison = splitTopLevel(expr, operator);
    if (comparison.length === 2) {
      return expressionCompare(
        evalExpression(comparison[0], row),
        evalExpression(comparison[1], row),
        operator
      );
    }
  }
  const notEqual = splitTopLevel(expr, "!=");
  if (notEqual.length === 2) {
    return !expressionEqual(
      evalExpression(notEqual[0], row),
      evalExpression(notEqual[1], row)
    );
  }
  const equal = splitTopLevel(expr, "==");
  if (equal.length === 2) {
    return expressionEqual(
      evalExpression(equal[0], row),
      evalExpression(equal[1], row)
    );
  }
  if (expr.startsWith("!")) {
    return !evalExpression(expr.slice(1), row);
  }
  const caseMatch = expr.match(/^case\((.*)\)$/s);
  if (caseMatch) {
    const args = splitArgs(caseMatch[1]);
    if (args.length < 3 || args.length % 2 === 0) return void 0;
    for (let index = 0; index < args.length - 1; index += 2) {
      if (evalExpression(args[index], row)) {
        return evalExpression(args[index + 1], row);
      }
    }
    return evalExpression(args.at(-1), row);
  }
  const containsMatch = expr.match(/^contains\((.*)\)$/s);
  if (containsMatch) {
    const args = splitArgs(containsMatch[1]);
    if (args.length !== 2) return void 0;
    const search = evalExpression(args[0], row);
    const item = evalExpression(args[1], row);
    if (Array.isArray(search)) {
      return search.some((value) => expressionEqual(value, item));
    }
    const searchText = githubString(search);
    const itemText = githubString(item);
    if (searchText === void 0 || itemText === void 0) return void 0;
    return searchText.toLowerCase().includes(itemText.toLowerCase());
  }
  const startsWithMatch = expr.match(/^startsWith\((.*)\)$/s);
  if (startsWithMatch) {
    const args = splitArgs(startsWithMatch[1]);
    if (args.length !== 2) return void 0;
    const search = githubString(evalExpression(args[0], row));
    const prefix = githubString(evalExpression(args[1], row));
    if (search === void 0 || prefix === void 0) return void 0;
    return search.toLowerCase().startsWith(prefix.toLowerCase());
  }
  const endsWithMatch = expr.match(/^endsWith\((.*)\)$/s);
  if (endsWithMatch) {
    const args = splitArgs(endsWithMatch[1]);
    if (args.length !== 2) return void 0;
    const search = githubString(evalExpression(args[0], row));
    const suffix = githubString(evalExpression(args[1], row));
    if (search === void 0 || suffix === void 0) return void 0;
    return search.toLowerCase().endsWith(suffix.toLowerCase());
  }
  const joinMatch = expr.match(/^join\((.*)\)$/s);
  if (joinMatch) {
    const args = splitArgs(joinMatch[1]);
    if (args.length < 1 || args.length > 2) return void 0;
    const value = evalExpression(args[0], row);
    const separator = args.length === 2 ? githubString(evalExpression(args[1], row)) : ",";
    if (separator === void 0) return void 0;
    if (Array.isArray(value)) {
      const values = value.map(githubString);
      if (values.some((item) => item === void 0)) return void 0;
      return values.join(separator);
    }
    return githubString(value);
  }
  const fromJsonMatch = expr.match(/^fromJSON\((.*)\)$/s);
  if (fromJsonMatch) {
    const args = splitArgs(fromJsonMatch[1]);
    if (args.length !== 1) return void 0;
    const value = evalExpression(args[0], row);
    if (typeof value !== "string") return void 0;
    try {
      return JSON.parse(value);
    } catch {
      return void 0;
    }
  }
  const toJsonMatch = expr.match(/^toJSON\((.*)\)$/s);
  if (toJsonMatch) {
    const args = splitArgs(toJsonMatch[1]);
    if (args.length !== 1) return void 0;
    const value = evalExpression(args[0], row);
    if (value === void 0) return void 0;
    return JSON.stringify(value, null, 2);
  }
  const formatMatch = expr.match(/^format\((.*)\)$/s);
  if (formatMatch) {
    const args = splitArgs(formatMatch[1]);
    if (!args.length) return void 0;
    const template = evalExpression(args[0], row);
    if (typeof template !== "string") return void 0;
    const values = args.slice(1).map((arg) => evalExpression(arg, row));
    if (values.some((value) => value === void 0)) return void 0;
    return template.replace(
      /\{(\d+)\}/g,
      (_, index) => String(values[Number(index)] ?? "")
    );
  }
  const matrixPath = matrixReferencePath(expr);
  if (matrixPath) {
    return getPath(row, matrixPath);
  }
  if (expr.startsWith("'") && expr.endsWith("'")) {
    return expr.slice(1, -1).replace(/''/g, "'");
  }
  if (expr.startsWith('"') && expr.endsWith('"')) {
    return expr.slice(1, -1);
  }
  if (expr === "true") return true;
  if (expr === "false") return false;
  if (expr === "null") return null;
  if (/^-?0x[0-9a-f]+$/i.test(expr)) return Number(expr);
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(expr)) {
    return Number(expr);
  }
  return void 0;
}
function splitTopLevel(text, operator) {
  const result = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index <= text.length - operator.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === quote && text[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth === 0 && text.slice(index, index + operator.length) === operator) {
      result.push(text.slice(start, index).trim());
      start = index + operator.length;
      index += operator.length - 1;
    }
  }
  if (!result.length) return [text.trim()];
  result.push(text.slice(start).trim());
  return result;
}
function renderName(template, row) {
  let failed = false;
  const rendered = template.replace(
    /\$\{\{([\s\S]*?)\}\}/g,
    (_, expression) => {
      const value = evalExpression(String(expression), row);
      if (value === void 0 || value !== null && typeof value === "object") {
        failed = true;
        return "";
      }
      return String(value ?? "");
    }
  );
  return failed ? null : rendered.trim();
}
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function matrixReferencePath(expression) {
  const normalized = expression.trim().replace(/\[['"]([^'"]+)['"]\]/g, (_, key) => `.${key}`);
  const match = normalized.match(
    /^matrix\.([A-Za-z0-9_*-]+(?:\.[A-Za-z0-9_*-]+)*)$/
  );
  return match?.[1] ?? null;
}
function directMatrixAxis(expression) {
  const path = matrixReferencePath(expression);
  return path && !path.includes("*") ? path : null;
}
function matrixAxesInTemplate(template) {
  const references = template.match(/\bmatrix(?:\.[A-Za-z0-9_*-]+|\[['"][^'"]+['"]\])+/g) ?? [];
  return [
    ...new Set(
      references.map(directMatrixAxis).filter((axis) => axis !== null)
    )
  ];
}
function dynamicExpressionMatcher(expression) {
  const direct = directMatrixAxis(expression);
  if (direct) {
    return { pattern: "(.+?)", axes: [direct], rejectedValues: [null] };
  }
  const fallback = splitTopLevel(expression.trim(), "||");
  if (fallback.length === 2) {
    const axis = directMatrixAxis(fallback[0]);
    const fallbackValue = evalExpression(fallback[1], {});
    const fallbackText = githubString(fallbackValue);
    if (axis && fallbackValue !== void 0 && fallbackText !== void 0) {
      return {
        pattern: "(.+?)",
        axes: [axis],
        rejectedValues: [/* @__PURE__ */ new Set([fallbackText])]
      };
    }
  }
  const formatMatch = expression.trim().match(/^format\((.*)\)$/s);
  if (!formatMatch) return null;
  const args = splitArgs(formatMatch[1]);
  if (!args.length) return null;
  const template = evalExpression(args[0], {});
  if (typeof template !== "string") return null;
  const axisArgs = args.slice(1).map(directMatrixAxis);
  if (axisArgs.some((axis) => axis === null)) return null;
  let pattern = "";
  const axes = [];
  const rejectedValues = [];
  let start = 0;
  for (const match of template.matchAll(/\{(\d+)\}/g)) {
    const index = match.index ?? 0;
    pattern += escapeRegex(template.slice(start, index));
    const argIndex = Number(match[1]);
    const axis = axisArgs[argIndex];
    if (!axis) return null;
    pattern += "(.+?)";
    axes.push(axis);
    rejectedValues.push(null);
    start = index + match[0].length;
  }
  pattern += escapeRegex(template.slice(start));
  return axes.length ? { pattern, axes, rejectedValues } : null;
}
function matchDynamicNameTemplate(template, name) {
  const expressionPattern = /\$\{\{([\s\S]*?)\}\}/g;
  let pattern = "^";
  const axes = [];
  const rejectedValues = [];
  let start = 0;
  let found = false;
  for (const match of template.matchAll(expressionPattern)) {
    found = true;
    const index = match.index ?? 0;
    pattern += escapeRegex(template.slice(start, index));
    const matcher = dynamicExpressionMatcher(match[1]);
    if (!matcher) return null;
    pattern += matcher.pattern;
    axes.push(...matcher.axes);
    rejectedValues.push(...matcher.rejectedValues);
    start = index + match[0].length;
  }
  if (!found || !axes.length) return null;
  pattern += escapeRegex(template.slice(start));
  pattern += "(?: / .*)?$";
  const matched = name.match(new RegExp(pattern));
  if (!matched) return null;
  const result = {};
  for (let index = 0; index < axes.length; index++) {
    const axis = axes[index];
    const value = matched[index + 1] ?? "";
    if (rejectedValues[index]?.has(value)) return null;
    if (axis in result && result[axis] !== value) return null;
    result[axis] = value;
  }
  return result;
}

// src/object.ts
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// src/axes.ts
function stableStringify(value) {
  if (value === null) return "null";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(",")}}`;
}
function axesFromMatrixEvidence(matrix) {
  return Object.fromEntries(
    Object.entries(matrix).sort(([a], [b]) => a.localeCompare(b)).map(([axis, value]) => [axis, stableStringify(value)])
  );
}
function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}
function hasRuntimeExpression(value) {
  if (typeof value === "string") return value.includes("${{");
  if (Array.isArray(value)) return value.some(hasRuntimeExpression);
  if (value && typeof value === "object") {
    return Object.values(value).some(
      hasRuntimeExpression
    );
  }
  return false;
}
function cartesian(entries) {
  let rows = [{}];
  for (const [axis, values] of entries) {
    rows = rows.flatMap(
      (row) => values.map((value) => ({ ...row, [axis]: value }))
    );
  }
  return rows;
}
function matchesRule(row, rule) {
  return Object.entries(rule).every(
    ([key, value]) => key in row && deepEqual(row[key], value)
  );
}
function expandStaticMatrix(matrix) {
  const axisEntries = [];
  const axisNames = [];
  let dynamic = "include" in matrix && !Array.isArray(matrix.include) || "exclude" in matrix && !Array.isArray(matrix.exclude) || hasRuntimeExpression(matrix.include) || hasRuntimeExpression(matrix.exclude);
  for (const [key, value] of Object.entries(matrix)) {
    if (key === "include" || key === "exclude") continue;
    axisNames.push(key);
    if (!Array.isArray(value) || hasRuntimeExpression(value)) {
      dynamic = true;
      continue;
    }
    axisEntries.push([key, value]);
  }
  if (dynamic) {
    return { rows: [], axes: axisNames, dynamic: true };
  }
  const originalAxes = axisNames;
  let baseRows = cartesian(axisEntries);
  const exclude = Array.isArray(matrix.exclude) ? matrix.exclude.filter(
    (item) => !!item && typeof item === "object" && !Array.isArray(item)
  ) : [];
  baseRows = baseRows.filter(
    (row) => !exclude.some((rule) => matchesRule(row, rule))
  );
  const include = Array.isArray(matrix.include) ? matrix.include.filter(
    (item) => !!item && typeof item === "object" && !Array.isArray(item)
  ) : [];
  let rows;
  if (!originalAxes.length && include.length) {
    rows = include.map((item) => ({ ...item }));
  } else {
    const derived = baseRows.map((original) => ({
      original,
      current: { ...original }
    }));
    const extras = [];
    for (const addition of include) {
      let applied = false;
      for (const item of derived) {
        const compatible = originalAxes.every(
          (axis) => !(axis in addition) || deepEqual(item.original[axis], addition[axis])
        );
        if (!compatible) continue;
        item.current = { ...item.current, ...addition };
        applied = true;
      }
      if (!applied) {
        extras.push({ ...addition });
      }
    }
    rows = [...derived.map((item) => item.current), ...extras];
  }
  const inferredIncludeAxes = originalAxes.length ? [] : [
    ...new Set(
      rows.flatMap(
        (row) => Object.entries(row).filter(
          ([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value)
        ).map(([key]) => key)
      )
    )
  ];
  return {
    rows,
    axes: [...originalAxes, ...inferredIncludeAxes],
    dynamic: false
  };
}
function axesForRow(row, axisNames) {
  const result = {};
  for (const axis of axisNames) {
    if (!(axis in row)) continue;
    result[axis] = stableStringify(row[axis]);
  }
  return result;
}
function defaultExpandedName(label, row) {
  const values = Object.values(row).map((value) => stableStringify(value)).filter((value) => value !== "");
  return values.length ? `${label} (${values.join(", ")})` : label;
}
function hasCaptureEvidenceStep(spec) {
  const record = asRecord(spec);
  if (!Array.isArray(record?.steps)) return false;
  return record.steps.some((rawStep) => {
    const step = asRecord(rawStep);
    const withConfig = asRecord(step?.with);
    return String(withConfig?.mode ?? "").trim().toLowerCase() === "capture" && typeof withConfig?.matrix === "string" && withConfig.matrix.includes("matrix");
  });
}
function workflowMatrixDefinitions(text) {
  const doc = asRecord((0, import_yaml.parse)(text));
  const jobs = asRecord(doc?.jobs) ?? {};
  const definitions = [];
  for (const [jobId, rawSpec] of Object.entries(jobs)) {
    const spec = asRecord(rawSpec);
    const strategy = asRecord(spec?.strategy);
    const matrix = strategy?.matrix;
    if (!matrix) continue;
    const rawName = typeof spec?.name === "string" ? spec.name : jobId;
    const captureEvidence = hasCaptureEvidenceStep(spec);
    const nameTemplate = typeof spec?.name === "string" && spec.name.includes("${{") ? spec.name : void 0;
    if (typeof matrix !== "object" || Array.isArray(matrix)) {
      if (typeof matrix !== "string" || !matrix.includes("${{")) continue;
      definitions.push({
        jobId,
        displayName: rawName.includes("${{") ? jobId : rawName,
        axes: nameTemplate ? matrixAxesInTemplate(nameTemplate) : [],
        dynamic: true,
        expectedCells: 0,
        renderedCells: 0,
        cells: [],
        nameTemplate,
        captureEvidence
      });
      continue;
    }
    const matrixRecord = asRecord(matrix);
    if (!matrixRecord) continue;
    const expanded = expandStaticMatrix(matrixRecord);
    const cells = [];
    if (!expanded.dynamic) {
      for (const row of expanded.rows) {
        const name = typeof spec?.name === "string" ? spec.name.includes("${{") ? renderName(spec.name, row) : defaultExpandedName(spec.name, row) : defaultExpandedName(jobId, row);
        if (!name) continue;
        cells.push({
          name,
          axes: axesForRow(row, expanded.axes),
          matrix: { ...row }
        });
      }
    }
    const displayName = rawName.includes("${{") ? jobId : rawName;
    definitions.push({
      jobId,
      displayName,
      axes: expanded.axes,
      dynamic: expanded.dynamic,
      expectedCells: expanded.dynamic ? 0 : expanded.rows.length,
      renderedCells: cells.length,
      cells,
      nameTemplate,
      captureEvidence
    });
  }
  return definitions;
}
function diagnoseAxesFromExpandedJobName(name, definitions) {
  const exactMatches = definitions.flatMap(
    (definition2) => definition2.cells.filter(
      (cell) => cell.name === name || name.startsWith(`${cell.name} / `)
    ).map((cell) => ({ definition: definition2, cell }))
  );
  if (exactMatches.length === 1) {
    const match2 = exactMatches[0];
    return {
      baseJob: match2.definition.jobId,
      axes: match2.cell.axes,
      source: "workflow-rendered-name"
    };
  }
  if (exactMatches.length > 1) {
    return {
      baseJob: name,
      axes: null,
      source: "unavailable",
      reason: "ambiguous-rendered-name"
    };
  }
  const dynamicMatches = definitions.flatMap((definition2) => {
    if (!definition2.dynamic || !definition2.nameTemplate) return [];
    const axes = matchDynamicNameTemplate(definition2.nameTemplate, name);
    return axes ? [{ definition: definition2, axes }] : [];
  });
  if (dynamicMatches.length === 1) {
    const match2 = dynamicMatches[0];
    return {
      baseJob: match2.definition.jobId,
      axes: match2.axes,
      source: "workflow-rendered-name"
    };
  }
  if (dynamicMatches.length > 1) {
    return {
      baseJob: name,
      axes: null,
      source: "unavailable",
      reason: "ambiguous-dynamic-name"
    };
  }
  const match = name.match(/^(.*?)\s+\((.*)\)$/);
  if (!match) {
    const direct = definitions.find(
      (candidate) => candidate.displayName === name || candidate.jobId === name
    );
    return {
      baseJob: direct?.jobId ?? name,
      axes: null,
      source: "unavailable",
      reason: direct?.dynamic ? "opaque-dynamic-job-name" : "job-name-not-matrix-shaped"
    };
  }
  const baseJob = match[1].trim();
  const inner = match[2].trim();
  const definition = definitions.find(
    (candidate) => candidate.displayName === baseJob || candidate.jobId === baseJob
  );
  if (!definition) {
    return {
      baseJob,
      axes: null,
      source: "unavailable",
      reason: "matrix-definition-not-found"
    };
  }
  if (!definition.axes.length) {
    return {
      baseJob: definition.jobId,
      axes: null,
      source: "unavailable",
      reason: "axis-names-unavailable"
    };
  }
  const values = definition.axes.length === 1 ? [inner] : inner.split(",").map((value) => value.trim());
  if (values.length !== definition.axes.length) {
    return {
      baseJob: definition.jobId,
      axes: null,
      source: "unavailable",
      reason: "axis-value-count-mismatch"
    };
  }
  return {
    baseJob: definition.jobId,
    axes: Object.fromEntries(
      definition.axes.map((axis, index) => [axis, values[index] ?? ""])
    ),
    source: "workflow-job-name"
  };
}

// src/analysis-summary.ts
function isConclusiveConclusion(conclusion) {
  return ["success", "failure", "timed_out", "neutral"].includes(
    conclusion ?? ""
  );
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function applyCapturedMatrixEvidence(observation, evidence) {
  const axes = axesFromMatrixEvidence(evidence.matrix);
  const suffix = Object.entries(axes).map(([axis, value]) => `${axis}=${value}`).join(", ");
  observation.baseJob = evidence.jobId;
  observation.axes = axes;
  observation.axisSource = "capture-evidence";
  observation.cell = `${observation.cell} [${suffix}]`;
}
function summarizeCells(matrixJobs, observations) {
  const byFingerprint = /* @__PURE__ */ new Map();
  const byCellFailure = /* @__PURE__ */ new Map();
  for (const item of observations) {
    const cluster = byFingerprint.get(item.fingerprint) ?? [];
    cluster.push(item);
    byFingerprint.set(item.fingerprint, cluster);
    const failures = byCellFailure.get(item.cell) ?? [];
    failures.push(item);
    byCellFailure.set(item.cell, failures);
  }
  const matrixByCell = /* @__PURE__ */ new Map();
  for (const item of matrixJobs) {
    const entry = matrixByCell.get(item.cell) ?? {
      baseJob: item.baseJob,
      axes: item.axes,
      axisSource: item.axisSource,
      runs: /* @__PURE__ */ new Set(),
      successRuns: /* @__PURE__ */ new Set(),
      failureRuns: /* @__PURE__ */ new Set(),
      otherRuns: /* @__PURE__ */ new Set(),
      runtimes: [],
      runnerLabelSets: /* @__PURE__ */ new Map()
    };
    entry.runs.add(item.runId);
    if (item.conclusion === "success") {
      entry.successRuns.add(item.runId);
    } else if (["failure", "timed_out"].includes(item.conclusion ?? "")) {
      entry.failureRuns.add(item.runId);
    } else {
      entry.otherRuns.add(item.runId);
    }
    if (item.runtimeSeconds !== null && isConclusiveConclusion(item.conclusion)) {
      entry.runtimes.push(item.runtimeSeconds);
    }
    if (item.runnerLabels?.length) {
      const labels = [...item.runnerLabels].sort();
      const key = JSON.stringify(labels);
      const current = entry.runnerLabelSets.get(key);
      entry.runnerLabelSets.set(key, {
        labels,
        count: (current?.count ?? 0) + 1
      });
    }
    if (entry.axisSource === "unavailable" && item.axisSource !== "unavailable") {
      entry.axes = item.axes;
      entry.axisSource = item.axisSource;
    }
    matrixByCell.set(item.cell, entry);
  }
  for (const item of observations) {
    if (!matrixByCell.has(item.cell)) {
      matrixByCell.set(item.cell, {
        baseJob: item.baseJob,
        axes: null,
        axisSource: "unavailable",
        runs: /* @__PURE__ */ new Set([item.runId]),
        successRuns: /* @__PURE__ */ new Set(),
        failureRuns: /* @__PURE__ */ new Set([item.runId]),
        otherRuns: /* @__PURE__ */ new Set(),
        runtimes: [],
        runnerLabelSets: /* @__PURE__ */ new Map()
      });
    }
  }
  return [...matrixByCell.entries()].map(([cell, meta]) => {
    const items = byCellFailure.get(cell) ?? [];
    const fingerprints = new Set(items.map((item) => item.fingerprint));
    return {
      cell,
      baseJob: meta.baseJob,
      axes: meta.axes,
      axisSource: meta.axisSource,
      runsObserved: meta.runs.size,
      successRuns: meta.successRuns.size,
      failureRuns: meta.failureRuns.size,
      otherRuns: meta.otherRuns.size,
      observations: items.length,
      distinctFailures: fingerprints.size,
      uniqueFailures: [...fingerprints].filter(
        (fingerprint2) => byFingerprint.get(fingerprint2)?.every((item) => item.cell === cell)
      ).length,
      medianRuntimeSeconds: median(meta.runtimes),
      runnerLabels: [...meta.runnerLabelSets.values()].sort(
        (a, b) => b.count - a.count || JSON.stringify(a.labels).localeCompare(JSON.stringify(b.labels))
      )[0]?.labels ?? []
    };
  }).sort(
    (a, b) => b.uniqueFailures - a.uniqueFailures || b.distinctFailures - a.distinctFailures || a.cell.localeCompare(b.cell)
  );
}

// src/diagnostics.ts
function captureRemediation(jobId) {
  return {
    kind: "capture",
    summary: "Capture the exact runtime matrix object from a step that has access to the matrix context. A reusable-workflow caller with uses: cannot add steps directly; place capture in an executable matrix job instead.",
    permissions: ["actions: read", "checks: read", "contents: read"],
    snippet: [
      "- uses: eburairu/matrixtrim@v0",
      "  with:",
      "    mode: capture",
      "    matrix: ${{ toJSON(matrix) }}",
      "",
      `# analysis later maps this evidence back to job: ${jobId}`
    ].join("\n")
  };
}
function captureEvidenceDiagnostic(problem, jobId, cell) {
  const messages = {
    missing: "The workflow opted into runtime matrix capture, but no matching evidence annotation was found for this observed job.",
    conflict: "Multiple conflicting runtime matrix evidence payloads were found for this observed job; MatrixTrim refused to choose one.",
    "fetch-error": "MatrixTrim could not read runtime matrix evidence annotations for this observed job."
  };
  return {
    code: problem === "missing" ? "capture-evidence-missing" : problem === "conflict" ? "capture-evidence-conflict" : "capture-evidence-fetch-error",
    severity: "warning",
    scope: "cell",
    jobId,
    cell,
    message: messages[problem],
    remediation: captureRemediation(jobId)
  };
}
function compactDiagnostics(items) {
  const byKey = /* @__PURE__ */ new Map();
  for (const item of items) {
    const key = [
      item.code,
      item.scope,
      item.jobId ?? "",
      item.scope === "cell" ? "" : item.cell ?? "",
      item.message
    ].join("\0");
    const current = byKey.get(key);
    if (current) {
      current.occurrences = (current.occurrences ?? 1) + (item.occurrences ?? 1);
      if (item.scope === "cell") {
        const affectedCells = /* @__PURE__ */ new Set([
          ...current.details?.affectedCells ?? [],
          ...current.cell ? [current.cell] : [],
          ...item.cell ? [item.cell] : []
        ]);
        current.details = {
          ...current.details,
          affectedCells: [...affectedCells].sort().slice(0, 10)
        };
        if (affectedCells.size > 1) current.cell = void 0;
      }
      continue;
    }
    byKey.set(key, { ...item, occurrences: item.occurrences ?? 1 });
  }
  return [...byKey.values()].sort(
    (a, b) => (a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1) || a.code.localeCompare(b.code) || (a.jobId ?? "").localeCompare(b.jobId ?? "") || (a.cell ?? "").localeCompare(b.cell ?? "")
  );
}

// src/evidence.ts
var MATRIX_EVIDENCE_PREFIX = "matrixtrim-evidence:v1:";
function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function encodeMatrixEvidence(jobId, matrixJson) {
  if (!jobId.trim()) throw new Error("GITHUB_JOB is required in capture mode");
  let matrix;
  try {
    matrix = JSON.parse(matrixJson);
  } catch {
    throw new Error("matrix input must be valid JSON from toJSON(matrix)");
  }
  if (!isObject(matrix)) {
    throw new Error("matrix input must decode to a JSON object");
  }
  const payload = {
    version: 1,
    jobId: jobId.trim(),
    matrix
  };
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > 24 * 1024) {
    throw new Error("matrix evidence exceeds the 24 KiB capture limit");
  }
  return MATRIX_EVIDENCE_PREFIX + Buffer.from(serialized, "utf8").toString("base64url");
}
function decodeMatrixEvidence(message) {
  const index = message.indexOf(MATRIX_EVIDENCE_PREFIX);
  if (index < 0) return null;
  const encoded = message.slice(index + MATRIX_EVIDENCE_PREFIX.length).trim().match(/^[A-Za-z0-9_-]+/)?.[0];
  if (!encoded) return null;
  try {
    const value = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    if (!isObject(value)) return null;
    if (value.version !== 1 || typeof value.jobId !== "string") return null;
    if (!isObject(value.matrix)) return null;
    return {
      version: 1,
      jobId: value.jobId,
      matrix: value.matrix
    };
  } catch {
    return null;
  }
}

// src/fingerprint.ts
var import_node_crypto = require("node:crypto");
var interesting = /(error|fail(?:ed|ure)?|exception|panic|assert|fatal|traceback|segmentation|timeout)/i;
var noise = /(process completed with exit code|##\[group\]|##\[endgroup\]|post job cleanup)/i;
var ansiColorPattern = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;]*m`,
  "g"
);
var strongRootCausePatterns = [
  /^(?:[A-Za-z_][\w.]*(?:Error|Exception|Failure)): .+/,
  /^error(?:\[[^\]]+\])?:\s+.+/i,
  /^fatal:\s+.+/i,
  /^panic:\s+.+/i,
  /panicked at/i,
  /segmentation fault/i
];
var summaryRootCausePatterns = [/^FAILED\s+.+/, /^ERROR\s+.+/, /^E\s{2,}.+/];
var derivativeRootCausePatterns = [
  /^error: could not compile\b.*\bdue to \d+ previous errors?/i,
  /^error: aborting due to \d+ previous errors?/i,
  /^error: test run failed$/i,
  /^error: test failed\b.*\bto rerun\b/i
];
var rootCausePatterns = [
  ...strongRootCausePatterns,
  ...summaryRootCausePatterns
];
function normalizeLogLine(input) {
  return input.replace(/^\uFEFF/, "").replace(ansiColorPattern, "").replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*/, "").replace(/##\[(?:error|warning)\]/gi, "").replace(
    /[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}/g,
    "<uuid>"
  ).replace(/0x[A-Fa-f0-9]+/g, "<hex>").replace(/:\d+:\d+(?=\)?(?:\s|$|:))/g, ":<line>:<col>").replace(/\bline \d+\b/gi, "line <n>").replace(
    /(\bthread\s+'[^']+'\s+)\(\d+\)(?=\s+panicked at)/gi,
    "$1(<thread>)"
  ).replace(
    /\b\d+(?:\.\d+)?\s*(?:ms|s|sec|seconds|minutes|min)\b/gi,
    "<duration>"
  ).replace(/\/home\/runner\/work\/[^\s:]+/g, "<workspace>").replace(/\b[A-Za-z]:\\[^\s)]+/g, "<path>").replace(/\\Users\\[^\\\s]+\\/g, "<user>\\").replace(/\s+/g, " ").trim();
}
function normalizeRootCause(line) {
  return line.replace(/\s+\((?:[A-Za-z]:\\|\/)[^)]+\)$/, " (<path>)").replace(/\s+\((?:<workspace>|<path>)\)?$/, " (<path>)").replace(/\b(?:py|node|python)\d{2,3}(?:-[\w-]+)?\b/gi, "<runtime>").replace(/\s+/g, " ").trim();
}
function normalizedLog(log) {
  return log.split(/\r?\n/).map(normalizeLogLine).filter((line) => line && !noise.test(line));
}
function rootCauses(lines) {
  const causes = lines.filter((line) => rootCausePatterns.some((pattern) => pattern.test(line))).map(normalizeRootCause);
  return [...new Set(causes)].slice(-8);
}
function fingerprint(signature, evidence) {
  const canonical = signature.join("\n").toLowerCase();
  const id = (0, import_node_crypto.createHash)("sha256").update(canonical).digest("hex").slice(0, 16);
  return { id, signature, evidence };
}
function embeddedSummaryRootCause(line) {
  if (!summaryRootCausePatterns.some((pattern) => pattern.test(line))) {
    return null;
  }
  const separator = line.lastIndexOf(" - ");
  if (separator < 0) return null;
  const tail = line.slice(separator + 3).trim();
  if (!tail || !interesting.test(tail)) return null;
  return normalizeRootCause(tail);
}
function eventRoots(lines, patterns) {
  const bySignature = /* @__PURE__ */ new Map();
  lines.forEach((line, index) => {
    if (!patterns.some((pattern) => pattern.test(line))) return;
    bySignature.set(normalizeRootCause(line), index);
  });
  return [...bySignature.entries()].map(([signature, index]) => ({ signature, index })).sort((a, b) => a.index - b.index).slice(-8);
}
function strongEventRoots(lines) {
  const bySignature = /* @__PURE__ */ new Map();
  lines.forEach((line, index) => {
    const signature = strongRootCausePatterns.some(
      (pattern) => pattern.test(line)
    ) ? normalizeRootCause(line) : embeddedSummaryRootCause(line);
    if (!signature) return;
    bySignature.set(signature, index);
  });
  const roots = [...bySignature.entries()].map(([signature, index]) => ({ signature, index })).sort((a, b) => a.index - b.index);
  const specific = roots.filter(
    (root) => !derivativeRootCausePatterns.some(
      (pattern) => pattern.test(root.signature)
    )
  );
  return (specific.length ? specific : roots).slice(-8);
}
function eventEvidence(lines, index) {
  const start = Math.max(0, index - 3);
  const end = Math.min(lines.length, index + 4);
  const nearby = lines.slice(start, end);
  const interestingNearby = nearby.filter((line) => interesting.test(line));
  return [
    ...new Set(interestingNearby.length ? interestingNearby : nearby)
  ].slice(-8);
}
function fingerprintFailures(log) {
  const lines = normalizedLog(log);
  const strong = strongEventRoots(lines);
  const roots = strong.length ? strong : eventRoots(lines, summaryRootCausePatterns);
  if (roots.length) {
    return roots.map(
      (root) => fingerprint([root.signature], eventEvidence(lines, root.index))
    );
  }
  return [fingerprintFailure(log)];
}
function fingerprintFailure(log) {
  const normalized = normalizedLog(log);
  const roots = rootCauses(normalized);
  const candidates = normalized.filter((line) => interesting.test(line));
  const evidenceSource = candidates.length ? candidates : normalized.slice(-20);
  const evidence = [...new Set(evidenceSource)].slice(-16);
  const signature = roots.length ? roots : [...new Set(evidenceSource)].slice(-6);
  return fingerprint(signature, evidence);
}

// src/github.ts
var GitHubHttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "GitHubHttpError";
  }
  status;
};
var MAX_PAGINATION_PAGES = 1e3;
function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function retryAfterMilliseconds(response) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds2 = Number(retryAfter);
    if (Number.isFinite(seconds2) && seconds2 >= 0) {
      return seconds2 * 1e3;
    }
    const timestamp = Date.parse(retryAfter);
    if (Number.isFinite(timestamp)) {
      return Math.max(0, timestamp - Date.now());
    }
  }
  if (response.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    if (Number.isFinite(reset) && reset > 0) {
      return Math.max(0, reset * 1e3 - Date.now());
    }
  }
  return null;
}
function repoPath(repo) {
  const parts = repo.split("/");
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new Error("repository must be in owner/repo form");
  }
  return parts.map(encodeURIComponent).join("/");
}
function refPath(ref) {
  return ref.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}
var GitHubClient = class {
  constructor(repo, token, options = {}) {
    this.repo = repo;
    this.token = token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.timeoutMs = options.timeoutMs ?? 3e4;
    this.maxRetries = options.maxRetries ?? 4;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 3e4;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new Error("GitHub request timeoutMs must be positive");
    }
    if (!Number.isInteger(this.maxRetries) || this.maxRetries < 0) {
      throw new Error("GitHub maxRetries must be a non-negative integer");
    }
  }
  repo;
  token;
  fetchImpl;
  sleep;
  timeoutMs;
  maxRetries;
  retryBaseMs;
  maxRetryDelayMs;
  headers() {
    return {
      Accept: "application/vnd.github+json",
      "User-Agent": "matrixtrim",
      "X-GitHub-Api-Version": "2022-11-28",
      ...this.token ? { Authorization: `Bearer ${this.token}` } : {}
    };
  }
  retryableResponse(response) {
    if ([429, 500, 502, 503, 504].includes(response.status)) return true;
    return response.status === 403 && (response.headers.has("retry-after") || response.headers.get("x-ratelimit-remaining") === "0");
  }
  retryDelay(response, attempt) {
    const explicit = response ? retryAfterMilliseconds(response) : null;
    const exponential = this.retryBaseMs * 2 ** attempt;
    return Math.min(explicit ?? exponential, this.maxRetryDelayMs);
  }
  async request(path, init, parse3) {
    const attempts = this.maxRetries + 1;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController();
      const externalSignal = init.signal;
      const forwardAbort = () => controller.abort();
      if (externalSignal?.aborted) controller.abort();
      else
        externalSignal?.addEventListener("abort", forwardAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response = null;
      try {
        response = await this.fetchImpl(`https://api.github.com${path}`, {
          ...init,
          headers: {
            ...this.headers(),
            ...init.headers ?? {}
          },
          signal: controller.signal
        });
        if (response.ok) {
          return await parse3(response);
        }
        const body = await response.text();
        const retryable = this.retryableResponse(response);
        if (!retryable || attempt === attempts - 1) {
          throw new GitHubHttpError(
            response.status,
            `GitHub API ${response.status}: ${body}`
          );
        }
        const explicitDelay = retryAfterMilliseconds(response);
        if (explicitDelay !== null && explicitDelay > this.maxRetryDelayMs) {
          throw new GitHubHttpError(
            response.status,
            `GitHub API ${response.status}: retry delay ${explicitDelay}ms exceeds ${this.maxRetryDelayMs}ms limit: ${body}`
          );
        }
        await this.sleep(this.retryDelay(response, attempt));
      } catch (error) {
        if (error instanceof GitHubHttpError) throw error;
        if (response) throw error;
        lastError = error;
        if (attempt === attempts - 1) {
          const timedOut = controller.signal.aborted && !externalSignal?.aborted;
          const reason = timedOut ? `timed out after ${this.timeoutMs}ms` : error instanceof Error ? error.message : String(error);
          throw new Error(
            `GitHub API request failed after ${attempts} attempt(s): ${path}: ${reason}`,
            { cause: error }
          );
        }
        await this.sleep(this.retryDelay(null, attempt));
      } finally {
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", forwardAbort);
      }
    }
    throw new Error("unreachable GitHub request state", { cause: lastError });
  }
  async json(path, init = {}) {
    return await this.request(
      path,
      init,
      async (response) => await response.json()
    );
  }
  async repositoryInfo() {
    return await this.json(`/repos/${repoPath(this.repo)}`);
  }
  async getRun(runId) {
    return await this.json(
      `/repos/${repoPath(this.repo)}/actions/runs/${runId}`
    );
  }
  async listRuns(limit, workflow) {
    const result = [];
    const base = workflow ? `/repos/${repoPath(this.repo)}/actions/workflows/${encodeURIComponent(workflow)}/runs` : `/repos/${repoPath(this.repo)}/actions/runs`;
    for (let page = 1; result.length < limit; page++) {
      const perPage = Math.min(100, limit - result.length);
      const data = await this.json(
        `${base}?status=completed&per_page=${perPage}&page=${page}`
      );
      result.push(...data.workflow_runs);
      if (data.workflow_runs.length < perPage) break;
    }
    return result.slice(0, limit);
  }
  async listJobs(runId) {
    const result = [];
    let totalCount = null;
    for (let page = 1; page <= MAX_PAGINATION_PAGES; page++) {
      const data = await this.json(
        `/repos/${repoPath(this.repo)}/actions/runs/${runId}/jobs?filter=all&per_page=100&page=${page}`
      );
      totalCount ??= data.total_count;
      result.push(...data.jobs);
      if (result.length >= data.total_count) {
        return result.slice(0, data.total_count);
      }
      if (!data.jobs.length) break;
    }
    if (totalCount !== null && result.length < totalCount) {
      throw new Error(
        `GitHub jobs pagination incomplete for run ${runId}: expected ${totalCount}, received ${result.length}`
      );
    }
    return result;
  }
  async listCheckRunAnnotations(checkRunId) {
    const result = [];
    for (let page = 1; page <= MAX_PAGINATION_PAGES; page++) {
      const items = await this.json(
        `/repos/${repoPath(this.repo)}/check-runs/${checkRunId}/annotations?per_page=100&page=${page}`
      );
      result.push(...items);
      if (items.length < 100) return result;
    }
    throw new Error(
      `GitHub check annotation pagination exceeded ${MAX_PAGINATION_PAGES} pages for check ${checkRunId}`
    );
  }
  async file(path, ref) {
    const encodedPath = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const data = await this.json(
      `/repos/${repoPath(this.repo)}/contents/${encodedPath}${refQuery}`
    );
    if (data.encoding !== "base64") {
      throw new Error(`unsupported GitHub content encoding: ${data.encoding}`);
    }
    return {
      text: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString(
        "utf8"
      ),
      sha: data.sha
    };
  }
  async fileText(path, ref) {
    return (await this.file(path, ref)).text;
  }
  async refSha(branch) {
    try {
      const data = await this.json(
        `/repos/${repoPath(this.repo)}/git/ref/heads/${refPath(branch)}`
      );
      return data.object.sha;
    } catch (error) {
      if (error instanceof GitHubHttpError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }
  async createBranch(branch, sha) {
    await this.json(`/repos/${repoPath(this.repo)}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha
      })
    });
  }
  async updateBranch(branch, sha) {
    await this.json(
      `/repos/${repoPath(this.repo)}/git/refs/heads/${refPath(branch)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha, force: true })
      }
    );
  }
  async updateFile(path, branch, sha, text, message) {
    const encodedPath = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    await this.json(`/repos/${repoPath(this.repo)}/contents/${encodedPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: Buffer.from(text, "utf8").toString("base64"),
        sha,
        branch
      })
    });
  }
  async listOpenPullRequests(branch, base) {
    const owner = this.repo.split("/")[0];
    return await this.json(
      `/repos/${repoPath(this.repo)}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=${encodeURIComponent(base)}&per_page=20`
    );
  }
  async createPullRequest(title, head, base, body) {
    return await this.json(
      `/repos/${repoPath(this.repo)}/pulls`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          head,
          base,
          body,
          draft: true
        })
      }
    );
  }
  async updatePullRequest(number, title, body) {
    return await this.json(
      `/repos/${repoPath(this.repo)}/pulls/${number}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body })
      }
    );
  }
  async listIssueComments(issueNumber) {
    const result = [];
    for (let page = 1; page <= MAX_PAGINATION_PAGES; page++) {
      const items = await this.json(
        `/repos/${repoPath(this.repo)}/issues/${issueNumber}/comments?per_page=100&page=${page}`
      );
      result.push(...items);
      if (items.length < 100) return result;
    }
    throw new Error(
      `GitHub issue comment pagination exceeded ${MAX_PAGINATION_PAGES} pages for issue ${issueNumber}`
    );
  }
  async createIssueComment(issueNumber, body) {
    return await this.json(
      `/repos/${repoPath(this.repo)}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      }
    );
  }
  async updateIssueComment(commentId, body) {
    return await this.json(
      `/repos/${repoPath(this.repo)}/issues/comments/${commentId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      }
    );
  }
  async jobLog(jobId) {
    return await this.request(
      `/repos/${repoPath(this.repo)}/actions/jobs/${jobId}/logs`,
      { redirect: "follow" },
      async (response) => await response.text()
    );
  }
};

// src/analyze.ts
function splitJobName(name) {
  const match = name.match(/^(.*?)\s+\((.+)\)$/);
  return match ? { baseJob: match[1].trim(), cell: name, matrixLike: true } : { baseJob: name, cell: name, matrixLike: false };
}
function isSkippedUnexpandedMatrixPlaceholder(job) {
  return job.conclusion === "skipped" && !job.labels?.length && /\$\{\{\s*matrix(?:\.|\[)/.test(job.name);
}
function durationSeconds(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  const value = (Date.parse(completedAt) - Date.parse(startedAt)) / 1e3;
  return Number.isFinite(value) && value >= 0 ? value : null;
}
async function mapLimit(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}
var AXIS_DIAGNOSTIC_CODES = {
  "ambiguous-rendered-name": "axis-ambiguous-rendered-name",
  "ambiguous-dynamic-name": "axis-ambiguous-dynamic-name",
  "job-name-not-matrix-shaped": "axis-job-name-not-matrix-shaped",
  "matrix-definition-not-found": "axis-definition-not-found",
  "axis-names-unavailable": "axis-names-unavailable",
  "axis-value-count-mismatch": "axis-value-count-mismatch",
  "opaque-dynamic-job-name": "axis-opaque-dynamic-job-name"
};
function axisDiagnosticMessage(reason) {
  return {
    "ambiguous-rendered-name": "More than one static matrix cell renders to this job name, so axis values cannot be assigned uniquely.",
    "ambiguous-dynamic-name": "More than one dynamic matrix name template matches this job name, so axis values cannot be assigned uniquely.",
    "job-name-not-matrix-shaped": "The observed job name does not expose a matrix suffix or a supported deterministic name template.",
    "matrix-definition-not-found": "No matrix definition matches the observed job-name prefix.",
    "axis-names-unavailable": "The runtime matrix values are visible in the job name, but the workflow does not expose stable axis names.",
    "axis-value-count-mismatch": "The number of values rendered in the job name does not match the known matrix axis count.",
    "opaque-dynamic-job-name": "The dynamic matrix job uses a name that does not expose runtime axis values."
  }[reason];
}
async function analyzeRepository(repository, options) {
  const client = new GitHubClient(repository, options.token);
  const concurrency = options.concurrency ?? 4;
  const diagnostics = [];
  let repositoryVisibility;
  try {
    const info = await client.repositoryInfo();
    repositoryVisibility = info.visibility ?? (info.private ? "private" : "public");
  } catch {
    repositoryVisibility = void 0;
  }
  const runs = options.runIds?.length ? await mapLimit(
    options.runIds,
    concurrency,
    (runId) => client.getRun(runId)
  ) : options.runId ? [await client.getRun(options.runId)] : await client.listRuns(options.limit, options.workflow);
  let workflowPath;
  const workflowPaths = [
    ...new Set(runs.map((run) => run.path).filter(Boolean))
  ];
  if (workflowPaths.length === 1) {
    workflowPath = workflowPaths[0];
  }
  const defaultDefinitionResults = await mapLimit(
    workflowPaths,
    concurrency,
    async (path) => {
      try {
        const workflowText = await client.fileText(path);
        return {
          path,
          ok: true,
          definitions: workflowMatrixDefinitions(workflowText)
        };
      } catch {
        return {
          path,
          ok: false,
          definitions: []
        };
      }
    }
  );
  const defaultDefinitionsByPath = new Map(
    defaultDefinitionResults.map((item) => [item.path, item])
  );
  const definitionInputs = [
    ...new Map(
      runs.filter((run) => run.path && run.head_sha).map((run) => [`${run.path}@${run.head_sha}`, run])
    ).values()
  ];
  const definitionResults = await mapLimit(
    definitionInputs,
    concurrency,
    async (run) => {
      const key = `${run.path}@${run.head_sha}`;
      try {
        const workflowText = await client.fileText(run.path, run.head_sha);
        return {
          key,
          definitions: workflowMatrixDefinitions(workflowText),
          usedFallback: false,
          error: false
        };
      } catch {
        const fallback = defaultDefinitionsByPath.get(run.path);
        if (fallback?.ok) {
          return {
            key,
            definitions: fallback.definitions,
            usedFallback: true,
            error: false
          };
        }
        return {
          key,
          definitions: [],
          usedFallback: false,
          error: true
        };
      }
    }
  );
  const definitionsByRevision = new Map(
    definitionResults.map((item) => [item.key, item.definitions])
  );
  const definitionsByRunId = new Map(
    runs.map((run) => [
      run.id,
      definitionsByRevision.get(`${run.path}@${run.head_sha}`) ?? []
    ])
  );
  const workflowDefinitionFallbacks = definitionResults.filter(
    (item) => item.usedFallback
  ).length;
  const workflowDefinitionErrors = definitionResults.filter(
    (item) => item.error
  ).length;
  const revisionDefinitions = definitionResults.flatMap(
    (item) => item.definitions
  );
  const workflowStaticDefinitionCells = revisionDefinitions.reduce(
    (sum, definition) => sum + definition.expectedCells,
    0
  );
  const workflowRenderedDefinitionCells = revisionDefinitions.reduce(
    (sum, definition) => sum + definition.renderedCells,
    0
  );
  const workflowRenderCoverage = workflowStaticDefinitionCells ? workflowRenderedDefinitionCells / workflowStaticDefinitionCells : null;
  const dynamicMatrixDefinitions = revisionDefinitions.filter(
    (definition) => definition.dynamic
  ).length;
  if (workflowDefinitionFallbacks) {
    diagnostics.push({
      code: "workflow-definition-fallback",
      severity: "warning",
      scope: "workflow",
      message: "One or more historical workflow revisions were unavailable; the default-branch workflow definition was used instead.",
      occurrences: workflowDefinitionFallbacks
    });
  }
  if (workflowDefinitionErrors) {
    diagnostics.push({
      code: "workflow-definition-unavailable",
      severity: "warning",
      scope: "workflow",
      message: "One or more historical workflow definitions could not be loaded, so matrix classification may be incomplete.",
      occurrences: workflowDefinitionErrors
    });
  }
  for (const definition of revisionDefinitions) {
    if (!definition.dynamic && definition.renderedCells < definition.expectedCells) {
      diagnostics.push({
        code: "static-name-render-incomplete",
        severity: "warning",
        scope: "definition",
        jobId: definition.jobId,
        message: "Some static matrix cells could not be rendered to deterministic GitHub job names.",
        details: {
          expectedCells: definition.expectedCells,
          renderedCells: definition.renderedCells
        }
      });
    }
    if (definition.dynamic && definition.axes.length === 0 && !definition.captureEvidence) {
      diagnostics.push({
        code: "dynamic-matrix-capture-not-configured",
        severity: "warning",
        scope: "definition",
        jobId: definition.jobId,
        message: "This dynamic matrix does not expose stable axis names and has no MatrixTrim runtime evidence capture step.",
        remediation: captureRemediation(definition.jobId)
      });
    }
  }
  const jobsByRun = await mapLimit(runs, concurrency, async (run) => ({
    run,
    jobs: await client.listJobs(run.id)
  }));
  const matrixJobs = [];
  const matrixJobIds = /* @__PURE__ */ new Set();
  const matrixJobById = /* @__PURE__ */ new Map();
  const axisFailureByJobId = /* @__PURE__ */ new Map();
  let workflowExpectedMatrixCells = 0;
  let workflowMatchedMatrixCells = 0;
  let inactiveStaticMatrixFamilies = 0;
  for (const { run, jobs } of jobsByRun) {
    const definitions = definitionsByRevision.get(`${run.path}@${run.head_sha}`) ?? [];
    if (isConclusiveConclusion(run.conclusion)) {
      for (const definition of definitions) {
        if (definition.dynamic) continue;
        const matched = definition.cells.filter(
          (cell) => jobs.some(
            (job) => job.name === cell.name || job.name.startsWith(`${cell.name} / `)
          )
        ).length;
        if (matched === 0) {
          inactiveStaticMatrixFamilies++;
          continue;
        }
        workflowExpectedMatrixCells += definition.expectedCells;
        workflowMatchedMatrixCells += matched;
        if (matched < definition.expectedCells) {
          const unmatched = definition.cells.filter(
            (cell) => !jobs.some(
              (job) => job.name === cell.name || job.name.startsWith(`${cell.name} / `)
            )
          ).map((cell) => cell.name).slice(0, 5);
          diagnostics.push({
            code: "static-cell-job-match-incomplete",
            severity: "warning",
            scope: "definition",
            jobId: definition.jobId,
            message: "Some expected static matrix cells did not match actual GitHub job names in an active matrix family.",
            details: {
              expectedCells: definition.expectedCells,
              matchedCells: matched,
              unmatchedSamples: unmatched
            }
          });
        }
      }
    }
    for (const job of jobs) {
      if (isSkippedUnexpandedMatrixPlaceholder(job)) {
        diagnostics.push({
          code: "skipped-unexpanded-matrix-placeholder",
          severity: "info",
          scope: "job",
          cell: job.name,
          message: "GitHub left a skipped matrix job at its unexpanded name template; this placeholder is not an executed matrix cell and is excluded from analysis."
        });
        continue;
      }
      const parsed = splitJobName(job.name);
      const inferred = diagnoseAxesFromExpandedJobName(job.name, definitions);
      const renderedMatch = inferred.source !== "unavailable";
      const fallbackDefinition = definitions.find(
        (definition) => definition.displayName === parsed.baseJob || definition.jobId === parsed.baseJob
      );
      const defaultNameFallback = parsed.matrixLike && (!definitions.length || !!fallbackDefinition);
      const exactDynamicDefinition = definitions.find(
        (definition) => definition.dynamic && definition.captureEvidence && (definition.displayName === job.name || definition.jobId === job.name)
      );
      if (!renderedMatch && !defaultNameFallback && !exactDynamicDefinition) {
        continue;
      }
      if (inferred.reason) {
        axisFailureByJobId.set(job.id, inferred.reason);
      }
      const observation = {
        runId: run.id,
        runNumber: run.run_number,
        runConclusion: run.conclusion,
        jobId: job.id,
        cell: job.name,
        baseJob: renderedMatch ? inferred.baseJob : exactDynamicDefinition?.jobId ?? fallbackDefinition?.jobId ?? parsed.baseJob,
        axes: inferred.axes,
        axisSource: inferred.source,
        conclusion: job.conclusion,
        runtimeSeconds: durationSeconds(job.started_at, job.completed_at),
        runnerLabels: job.labels ?? []
      };
      matrixJobIds.add(job.id);
      matrixJobs.push(observation);
      matrixJobById.set(job.id, observation);
    }
  }
  const captureCandidates = matrixJobs.filter((observation) => {
    if (observation.axes !== null) return false;
    return definitionsByRunId.get(observation.runId)?.some(
      (definition) => definition.dynamic && definition.captureEvidence && definition.jobId === observation.baseJob
    ) ?? false;
  });
  let captureEvidenceJobs = 0;
  let captureEvidenceErrors = 0;
  await mapLimit(
    captureCandidates,
    Math.min(concurrency, 4),
    async (observation) => {
      try {
        const annotations = await client.listCheckRunAnnotations(
          observation.jobId
        );
        const matches = annotations.map((annotation) => decodeMatrixEvidence(annotation.message)).filter(
          (evidence) => evidence !== null && evidence.jobId === observation.baseJob
        );
        if (!matches.length) {
          diagnostics.push(
            captureEvidenceDiagnostic(
              "missing",
              observation.baseJob,
              observation.cell
            )
          );
          return;
        }
        const unique = new Map(
          matches.map((evidence) => [
            JSON.stringify(axesFromMatrixEvidence(evidence.matrix)),
            evidence
          ])
        );
        if (unique.size !== 1) {
          captureEvidenceErrors++;
          diagnostics.push(
            captureEvidenceDiagnostic(
              "conflict",
              observation.baseJob,
              observation.cell
            )
          );
          return;
        }
        applyCapturedMatrixEvidence(observation, [...unique.values()][0]);
        captureEvidenceJobs++;
      } catch {
        captureEvidenceErrors++;
        diagnostics.push(
          captureEvidenceDiagnostic(
            "fetch-error",
            observation.baseJob,
            observation.cell
          )
        );
      }
    }
  );
  for (const observation of matrixJobs) {
    if (observation.axes !== null) continue;
    const reason = axisFailureByJobId.get(observation.jobId);
    if (!reason) continue;
    const definition = definitionsByRunId.get(observation.runId)?.find((item) => item.jobId === observation.baseJob);
    diagnostics.push({
      code: AXIS_DIAGNOSTIC_CODES[reason],
      severity: "warning",
      scope: "cell",
      jobId: observation.baseJob,
      cell: observation.cell,
      message: axisDiagnosticMessage(reason),
      ...definition?.dynamic ? { remediation: captureRemediation(observation.baseJob) } : {}
    });
  }
  const allFailedJobs = jobsByRun.flatMap(
    ({ run, jobs }) => jobs.filter((job) => ["failure", "timed_out"].includes(job.conclusion ?? "")).map((job) => ({ run, job }))
  );
  const failed = allFailedJobs.filter(({ job }) => matrixJobIds.has(job.id));
  const ignoredNonMatrixJobs = allFailedJobs.length - failed.length;
  let logErrors = 0;
  let expiredLogs = 0;
  const observations = (await mapLimit(failed, concurrency, async ({ run, job }) => {
    try {
      const log = await client.jobLog(job.id);
      const fingerprints = fingerprintFailures(log);
      const matrixJob = matrixJobById.get(job.id);
      if (!matrixJob) {
        throw new Error(`matrix job metadata missing for job ${job.id}`);
      }
      return fingerprints.map(
        (fingerprint2) => ({
          runId: run.id,
          runNumber: run.run_number,
          jobId: job.id,
          cell: matrixJob.cell,
          baseJob: matrixJob.baseJob,
          fingerprint: fingerprint2.id,
          signature: fingerprint2.signature,
          evidence: fingerprint2.evidence
        })
      );
    } catch (error) {
      if (error instanceof GitHubHttpError && error.status === 410) {
        expiredLogs++;
      } else {
        logErrors++;
      }
      return [];
    }
  })).flat();
  const byFingerprint = /* @__PURE__ */ new Map();
  for (const item of observations) {
    const cluster = byFingerprint.get(item.fingerprint) ?? [];
    cluster.push(item);
    byFingerprint.set(item.fingerprint, cluster);
  }
  const clusters = [...byFingerprint.entries()].map(([fingerprint2, items]) => ({
    fingerprint: fingerprint2,
    signature: items[0].signature,
    cells: [...new Set(items.map((item) => item.cell))].sort(),
    observations: items.length
  })).sort(
    (a, b) => b.cells.length - a.cells.length || b.observations - a.observations || a.fingerprint.localeCompare(b.fingerprint)
  );
  const cells = summarizeCells(matrixJobs, observations);
  const conclusiveRunTimes = runs.filter((run) => isConclusiveConclusion(run.conclusion)).map((run) => Date.parse(run.created_at)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const runWindowDays = conclusiveRunTimes.length >= 2 ? (conclusiveRunTimes.at(-1) - conclusiveRunTimes[0]) / (24 * 60 * 60 * 1e3) : null;
  const projectedRunsPer30Days = runWindowDays !== null && runWindowDays >= 7 ? (conclusiveRunTimes.length - 1) / runWindowDays * 30 : null;
  return {
    repository,
    repositoryVisibility,
    workflow: options.workflow,
    workflowPath,
    runsAnalyzed: runs.length,
    failedJobs: failed.length,
    ignoredNonMatrixJobs,
    fingerprints: byFingerprint.size,
    logErrors,
    expiredLogs,
    workflowDefinitionFallbacks,
    workflowDefinitionErrors,
    workflowStaticDefinitionCells,
    workflowRenderedDefinitionCells,
    workflowRenderCoverage,
    workflowExpectedMatrixCells,
    workflowMatchedMatrixCells,
    workflowMatchCoverage: workflowExpectedMatrixCells ? workflowMatchedMatrixCells / workflowExpectedMatrixCells : null,
    inactiveStaticMatrixFamilies,
    dynamicMatrixDefinitions,
    captureEvidenceCandidates: captureCandidates.length,
    captureEvidenceJobs,
    captureEvidenceErrors,
    diagnostics: compactDiagnostics(diagnostics),
    runWindowDays,
    projectedRunsPer30Days,
    cells,
    clusters,
    observations,
    matrixJobs
  };
}

// src/coverage.ts
function combinations(items, size) {
  if (size <= 0) return [[]];
  if (items.length < size) return [];
  if (size === 1) return items.map((item) => [item]);
  const result = [];
  for (let index = 0; index <= items.length - size; index++) {
    const head = items[index];
    for (const tail of combinations(items.slice(index + 1), size - 1)) {
      result.push([head, ...tail]);
    }
  }
  return result;
}
function stablePairs(axes) {
  return Object.entries(axes).sort(([a], [b]) => a.localeCompare(b));
}
function tWiseCoverageForCell(cell, strength = 2) {
  if (!cell.axes || strength < 1) return [];
  const entries = stablePairs(cell.axes);
  return combinations(entries, strength).map((combo) => {
    const axes = combo.map(([axis]) => axis);
    const values = combo.map(([, value]) => value);
    const encoded = combo.map(
      ([axis, value]) => `${encodeURIComponent(axis)}=${encodeURIComponent(value)}`
    ).join("&");
    return {
      id: `tw:${strength}:${encodeURIComponent(cell.baseJob)}:${encoded}`,
      baseJob: cell.baseJob,
      axes,
      values
    };
  });
}
function observedCombinatorialCoverage(cells, maxStrength = 2) {
  const tokensById = /* @__PURE__ */ new Map();
  const byCell = /* @__PURE__ */ new Map();
  const unresolvedCells = [];
  let eligibleCells = 0;
  for (const cell of cells) {
    if (!cell.axes) {
      unresolvedCells.push(cell.cell);
      continue;
    }
    const tokens = [];
    const availableStrength = Math.min(
      maxStrength,
      Object.keys(cell.axes).length
    );
    for (let strength = 1; strength <= availableStrength; strength++) {
      tokens.push(...tWiseCoverageForCell(cell, strength));
    }
    if (tokens.length) eligibleCells++;
    const ids = new Set(tokens.map((token) => token.id));
    byCell.set(cell.cell, ids);
    for (const token of tokens) tokensById.set(token.id, token);
  }
  return {
    tokens: [...tokensById.values()].sort((a, b) => a.id.localeCompare(b.id)),
    byCell,
    unresolvedCells,
    eligibleCells
  };
}

// src/config.ts
var import_yaml2 = __toESM(require_dist(), 1);
var EMPTY_CONSTRAINTS = {
  keep: [],
  require: []
};
function stringRecord(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be a mapping`);
  }
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key.trim()) {
      throw new Error(`${context} contains an empty axis name`);
    }
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
      throw new Error(`${context}.${key} must be a string, number, or boolean`);
    }
    result[key] = String(raw);
  }
  if (!Object.keys(result).length) {
    throw new Error(`${context} must contain at least one axis`);
  }
  return result;
}
function parseMatrixTrimConfig(text) {
  const raw = (0, import_yaml2.parse)(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("MatrixTrim config must be a YAML mapping");
  }
  const root = raw;
  const version = root.version ?? 1;
  if (version !== 1) {
    throw new Error(
      `unsupported MatrixTrim config version: ${String(version)}`
    );
  }
  const constraintsRaw = root.constraints ?? {};
  if (!constraintsRaw || typeof constraintsRaw !== "object" || Array.isArray(constraintsRaw)) {
    throw new Error("constraints must be a mapping");
  }
  const constraintsObject = constraintsRaw;
  const keepRaw = constraintsObject.keep ?? [];
  if (!Array.isArray(keepRaw)) {
    throw new Error("constraints.keep must be a list of exact cell names");
  }
  const keep = keepRaw.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(
        `constraints.keep[${index}] must be a non-empty cell name`
      );
    }
    return item.trim();
  });
  const requireRaw = constraintsObject.require ?? [];
  if (!Array.isArray(requireRaw)) {
    throw new Error("constraints.require must be a list of selectors");
  }
  const require2 = requireRaw.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`constraints.require[${index}] must be a mapping`);
    }
    const selector = item;
    const baseJobRaw = selector.baseJob;
    if (baseJobRaw !== void 0 && (typeof baseJobRaw !== "string" || !baseJobRaw.trim())) {
      throw new Error(
        `constraints.require[${index}].baseJob must be a non-empty string`
      );
    }
    return {
      ...typeof baseJobRaw === "string" ? { baseJob: baseJobRaw.trim() } : {},
      axes: stringRecord(selector.axes, `constraints.require[${index}].axes`)
    };
  });
  return {
    version: 1,
    constraints: {
      keep: [...new Set(keep)],
      require: require2
    }
  };
}
async function loadRepositoryConfig(client, path = ".matrixtrim.yml", required = false) {
  try {
    return parseMatrixTrimConfig(await client.fileText(path));
  } catch (error) {
    if (!required && error instanceof GitHubHttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// src/optimizer.ts
var EPSILON = 1e-9;
function compareIds(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function solutionBetter(candidate, current) {
  if (candidate.cost < current.cost - EPSILON) return true;
  if (candidate.cost > current.cost + EPSILON) return false;
  if (candidate.selected.length < current.selected.length) return true;
  if (candidate.selected.length > current.selected.length) return false;
  const a = [...candidate.selected].sort(compareIds);
  const b = [...current.selected].sort(compareIds);
  for (let index = 0; index < a.length; index++) {
    const delta = compareIds(a[index], b[index]);
    if (delta !== 0) return delta < 0;
  }
  return false;
}
function validate(candidates, requirements) {
  const covered = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.cost) || candidate.cost <= 0) {
      throw new Error(
        `set-cover candidate ${candidate.id} has invalid cost ${candidate.cost}`
      );
    }
    for (const token of candidate.covers) covered.add(token);
  }
  const missing = [...requirements].filter((token) => !covered.has(token));
  if (missing.length) {
    throw new Error(
      `set-cover universe contains ${missing.length} uncovered requirement(s)`
    );
  }
}
function pruneRedundant(selected, requirements) {
  const result = [...selected];
  let changed = true;
  while (changed) {
    changed = false;
    const removable = [...result].sort((a, b) => {
      const costDelta = b.cost - a.cost;
      if (Math.abs(costDelta) > EPSILON) return costDelta;
      return compareIds(a.id, b.id);
    });
    for (const candidate of removable) {
      const covered = /* @__PURE__ */ new Set();
      for (const item of result) {
        if (item.id === candidate.id) continue;
        for (const token of item.covers) covered.add(token);
      }
      if ([...requirements].every((token) => covered.has(token))) {
        const index = result.findIndex((item) => item.id === candidate.id);
        if (index >= 0) result.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return result;
}
function greedyWeightedSetCover(candidates, requirements) {
  validate(candidates, requirements);
  const uncovered = new Set(requirements);
  const remaining = new Map(
    candidates.slice().sort((a, b) => compareIds(a.id, b.id)).map((candidate) => [candidate.id, candidate])
  );
  const selected = [];
  while (uncovered.size) {
    let best;
    let bestNew = [];
    let bestScore = -1;
    for (const candidate of remaining.values()) {
      const newlyCovered = [...candidate.covers].filter(
        (token) => uncovered.has(token)
      );
      if (!newlyCovered.length) continue;
      const score = newlyCovered.length / candidate.cost;
      if (score > bestScore + EPSILON || Math.abs(score - bestScore) <= EPSILON && newlyCovered.length > bestNew.length || Math.abs(score - bestScore) <= EPSILON && newlyCovered.length === bestNew.length && best && compareIds(candidate.id, best.id) < 0) {
        best = candidate;
        bestNew = newlyCovered;
        bestScore = score;
      }
    }
    if (!best) {
      throw new Error("unable to satisfy set-cover requirements");
    }
    selected.push(best);
    remaining.delete(best.id);
    for (const token of bestNew) uncovered.delete(token);
  }
  const pruned = pruneRedundant(selected, requirements);
  return {
    selected: pruned.map((candidate) => candidate.id).sort(compareIds),
    cost: pruned.reduce((sum, candidate) => sum + candidate.cost, 0)
  };
}
function exactWeightedSetCover(candidates, requirements, options = {}) {
  validate(candidates, requirements);
  const maxNodes = options.maxNodes ?? 25e4;
  if (!Number.isInteger(maxNodes) || maxNodes < 1) {
    throw new Error("maxNodes must be a positive integer");
  }
  const sortedCandidates = candidates.slice().sort((a, b) => compareIds(a.id, b.id));
  const candidateById = new Map(
    sortedCandidates.map((candidate, index) => [candidate.id, index])
  );
  const requirementCandidates = /* @__PURE__ */ new Map();
  for (const requirement of requirements) {
    requirementCandidates.set(
      requirement,
      sortedCandidates.map(
        (candidate, index) => candidate.covers.has(requirement) ? index : -1
      ).filter((index) => index >= 0)
    );
  }
  const initial = options.initial ?? greedyWeightedSetCover(sortedCandidates, requirements);
  let best = {
    selected: [...initial.selected].sort(compareIds),
    cost: initial.cost
  };
  let searchNodes = 0;
  let aborted = false;
  function recurse(uncovered, selectedIndices, selectedSet, cost) {
    if (aborted) return;
    searchNodes++;
    if (searchNodes > maxNodes) {
      aborted = true;
      return;
    }
    if (cost > best.cost + EPSILON) return;
    if (!uncovered.size) {
      const candidate = {
        selected: selectedIndices.map((index) => sortedCandidates[index].id).sort(compareIds),
        cost
      };
      if (solutionBetter(candidate, best)) best = candidate;
      return;
    }
    let maxRatio = 0;
    for (let index = 0; index < sortedCandidates.length; index++) {
      if (selectedSet.has(index)) continue;
      const candidate = sortedCandidates[index];
      let gain = 0;
      for (const token of candidate.covers) {
        if (uncovered.has(token)) gain++;
      }
      if (!gain) continue;
      maxRatio = Math.max(maxRatio, gain / candidate.cost);
    }
    if (!maxRatio) return;
    const optimisticCost = cost + uncovered.size / maxRatio;
    if (optimisticCost > best.cost + EPSILON) return;
    let pivot;
    let pivotCandidates = [];
    for (const requirement of [...uncovered].sort(compareIds)) {
      const eligible = (requirementCandidates.get(requirement) ?? []).filter(
        (index) => !selectedSet.has(index)
      );
      if (!eligible.length) return;
      if (pivot === void 0 || eligible.length < pivotCandidates.length) {
        pivot = requirement;
        pivotCandidates = eligible;
        if (eligible.length === 1) break;
      }
    }
    if (pivot === void 0) return;
    pivotCandidates.sort((a, b) => {
      const left = sortedCandidates[a];
      const right = sortedCandidates[b];
      let leftGain = 0;
      let rightGain = 0;
      for (const token of left.covers) {
        if (uncovered.has(token)) leftGain++;
      }
      for (const token of right.covers) {
        if (uncovered.has(token)) rightGain++;
      }
      const leftScore = leftGain / left.cost;
      const rightScore = rightGain / right.cost;
      if (Math.abs(leftScore - rightScore) > EPSILON) {
        return rightScore - leftScore;
      }
      if (leftGain !== rightGain) return rightGain - leftGain;
      if (Math.abs(left.cost - right.cost) > EPSILON) {
        return left.cost - right.cost;
      }
      return compareIds(left.id, right.id);
    });
    for (const index of pivotCandidates) {
      if (aborted) break;
      const candidate = sortedCandidates[index];
      const nextCost = cost + candidate.cost;
      if (nextCost > best.cost + EPSILON) continue;
      const nextUncovered = new Set(uncovered);
      for (const token of candidate.covers) nextUncovered.delete(token);
      const nextSelectedSet = new Set(selectedSet);
      nextSelectedSet.add(index);
      recurse(
        nextUncovered,
        [...selectedIndices, index],
        nextSelectedSet,
        nextCost
      );
    }
  }
  recurse(new Set(requirements), [], /* @__PURE__ */ new Set(), 0);
  for (const id of best.selected) {
    if (!candidateById.has(id)) {
      throw new Error(
        `initial set-cover solution references unknown candidate: ${id}`
      );
    }
  }
  return {
    ...best,
    optimal: !aborted,
    searchNodes,
    aborted
  };
}

// src/pricing.ts
var STANDARD_LABEL_PRICES = [
  {
    test: (label) => label === "ubuntu-slim",
    price: {
      sku: "actions_linux_slim",
      usdPerMinute: 2e-3,
      label: "Linux 1-core x64"
    }
  },
  {
    test: (label) => /^ubuntu-(?:22\.04|24\.04|26\.04)-arm$/.test(label),
    price: {
      sku: "actions_linux_arm",
      usdPerMinute: 5e-3,
      label: "Linux 2-core arm64"
    }
  },
  {
    test: (label) => label === "ubuntu-latest" || /^ubuntu-(?:22\.04|24\.04|26\.04)$/.test(label),
    price: {
      sku: "actions_linux",
      usdPerMinute: 6e-3,
      label: "Linux 2-core x64"
    }
  },
  {
    test: (label) => /^windows-11-(?:arm|vs2026-arm)$/.test(label),
    price: {
      sku: "actions_windows_arm",
      usdPerMinute: 0.01,
      label: "Windows 2-core arm64"
    }
  },
  {
    test: (label) => label === "windows-latest" || /^windows-(?:2022|2025(?:-vs2026)?)$/.test(label),
    price: {
      sku: "actions_windows",
      usdPerMinute: 0.01,
      label: "Windows 2-core x64"
    }
  },
  {
    test: (label) => label === "macos-latest" || /^macos-(?:14|15|26)(?:-intel)?$/.test(label) || label === "xcode-27",
    price: {
      sku: "actions_macos",
      usdPerMinute: 0.062,
      label: "macOS standard"
    }
  }
];
function inferStandardRunnerPrice(labels) {
  const classification = classifyRunner(labels);
  return classification.kind === "standard" ? classification.price : null;
}
function classifyRunner(labels) {
  if (!labels?.length) return { kind: "unknown" };
  const normalized = labels.map((label) => label.trim().toLowerCase());
  if (normalized.includes("self-hosted")) {
    return { kind: "self-hosted" };
  }
  for (const label of normalized) {
    for (const candidate of STANDARD_LABEL_PRICES) {
      if (candidate.test(label)) {
        return { kind: "standard", price: candidate.price };
      }
    }
  }
  return { kind: "unknown" };
}
function billedMinutes(runtimeSeconds) {
  if (!Number.isFinite(runtimeSeconds) || runtimeSeconds < 0) {
    throw new Error("runtimeSeconds must be a finite non-negative number");
  }
  return Math.max(1, Math.ceil(runtimeSeconds / 60));
}
function standardRunnerListPriceUsd(runtimeSeconds, labels) {
  if (runtimeSeconds === null) return null;
  const runner = inferStandardRunnerPrice(labels);
  if (!runner) return null;
  return billedMinutes(runtimeSeconds) * runner.usdPerMinute;
}
function median2(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function isConclusiveJob(job) {
  return ["success", "failure", "timed_out", "neutral"].includes(
    job.conclusion ?? ""
  );
}
function estimateJob(job, visibility) {
  if (job.runtimeSeconds === null || !isConclusiveJob(job)) return null;
  const classification = classifyRunner(job.runnerLabels);
  if (classification.kind === "unknown") {
    return { rateCard: null, estimatedCharge: null };
  }
  if (classification.kind === "self-hosted") {
    return { rateCard: null, estimatedCharge: 0 };
  }
  const rateCard = billedMinutes(job.runtimeSeconds) * classification.price.usdPerMinute;
  if (visibility === "public") {
    return { rateCard, estimatedCharge: 0 };
  }
  if (visibility === "private" || visibility === "internal") {
    return { rateCard, estimatedCharge: rateCard };
  }
  return { rateCard, estimatedCharge: null };
}
function cellPrices(report) {
  const jobsByCell = /* @__PURE__ */ new Map();
  for (const job of report.matrixJobs ?? []) {
    const items = jobsByCell.get(job.cell) ?? [];
    items.push(job);
    jobsByCell.set(job.cell, items);
  }
  const visibility = report.repositoryVisibility ?? null;
  const result = /* @__PURE__ */ new Map();
  for (const cell of report.cells) {
    const samples = (jobsByCell.get(cell.cell) ?? []).map((job) => estimateJob(job, visibility)).filter((value) => value !== null);
    if (!samples.length) {
      result.set(cell.cell, { rateCard: null, estimatedCharge: null });
      continue;
    }
    const rateCardKnown = samples.every((sample) => sample.rateCard !== null);
    const chargeKnown = samples.every(
      (sample) => sample.estimatedCharge !== null
    );
    result.set(cell.cell, {
      rateCard: rateCardKnown ? median2(samples.map((sample) => sample.rateCard)) : null,
      estimatedCharge: chargeKnown ? median2(samples.map((sample) => sample.estimatedCharge)) : null
    });
  }
  return result;
}
function totalFor(names, prices, field) {
  const values = names.map((name) => prices.get(name)?.[field] ?? null);
  const known = values.filter((value) => value !== null);
  if (known.length !== values.length) return null;
  return known.reduce((sum, value) => sum + value, 0);
}
function savings(current, selected) {
  if (current === null || selected === null) {
    return { amount: null, percent: null };
  }
  const amount = current - selected;
  return {
    amount,
    percent: current > 0 ? amount / current * 100 : null
  };
}
function monthly(perRun, projectedRunsPer30Days) {
  return perRun !== null && projectedRunsPer30Days != null ? perRun * projectedRunsPer30Days : null;
}
function estimatePricing(report, selectedCells) {
  const prices = cellPrices(report);
  const currentNames = report.cells.map((cell) => cell.cell);
  const currentRateCardUsdPerRun = totalFor(currentNames, prices, "rateCard");
  const selectedRateCardUsdPerRun = totalFor(selectedCells, prices, "rateCard");
  const currentEstimatedChargeUsdPerRun = totalFor(
    currentNames,
    prices,
    "estimatedCharge"
  );
  const selectedEstimatedChargeUsdPerRun = totalFor(
    selectedCells,
    prices,
    "estimatedCharge"
  );
  const rateCardSavings = savings(
    currentRateCardUsdPerRun,
    selectedRateCardUsdPerRun
  );
  const chargeSavings = savings(
    currentEstimatedChargeUsdPerRun,
    selectedEstimatedChargeUsdPerRun
  );
  const pricedCells = currentNames.filter(
    (name) => prices.get(name)?.estimatedCharge !== null
  ).length;
  const selectedPricedCells = selectedCells.filter(
    (name) => prices.get(name)?.estimatedCharge !== null
  ).length;
  const unpricedCells = currentNames.filter(
    (name) => prices.get(name)?.estimatedCharge === null
  );
  const projectedRunsPer30Days = report.runWindowDays !== null && report.runWindowDays !== void 0 && report.runWindowDays < 7 ? null : report.projectedRunsPer30Days ?? null;
  const visibility = report.repositoryVisibility ?? null;
  let note;
  if (visibility === "public") {
    note = "Standard GitHub-hosted runners are free in public repositories; rate-card values are comparison-only. Larger/unknown runners are not estimated.";
  } else if (visibility === "private" || visibility === "internal") {
    note = "Estimated GitHub charge uses standard-runner overage rates before plan-included minutes. Larger/unknown runners are not estimated.";
  } else {
    note = "Repository visibility is unavailable, so GitHub charge cannot be estimated. Standard-runner rate-card values may still be available.";
  }
  if (report.runWindowDays !== null && report.runWindowDays !== void 0 && report.runWindowDays < 7) {
    note += ` 30-day projection is omitted because the observed run window is only ${report.runWindowDays.toFixed(1)} days (<7 days).`;
  }
  return {
    repositoryVisibility: visibility,
    currentCells: currentNames.length,
    pricedCells,
    selectedCells: selectedCells.length,
    selectedPricedCells,
    unpricedCells,
    currentRateCardUsdPerRun,
    selectedRateCardUsdPerRun,
    rateCardSavingsUsdPerRun: rateCardSavings.amount,
    rateCardReductionPercent: rateCardSavings.percent,
    currentEstimatedChargeUsdPerRun,
    selectedEstimatedChargeUsdPerRun,
    estimatedChargeSavingsUsdPerRun: chargeSavings.amount,
    estimatedChargeReductionPercent: chargeSavings.percent,
    projectedRunsPer30Days,
    currentRateCardUsdPer30Days: monthly(
      currentRateCardUsdPerRun,
      projectedRunsPer30Days
    ),
    selectedRateCardUsdPer30Days: monthly(
      selectedRateCardUsdPerRun,
      projectedRunsPer30Days
    ),
    currentEstimatedChargeUsdPer30Days: monthly(
      currentEstimatedChargeUsdPerRun,
      projectedRunsPer30Days
    ),
    selectedEstimatedChargeUsdPer30Days: monthly(
      selectedEstimatedChargeUsdPerRun,
      projectedRunsPer30Days
    ),
    note
  };
}

// src/recommend.ts
function median3(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function costFor(cell, fallback) {
  return Math.max(cell.medianRuntimeSeconds ?? fallback, 0.1);
}
function matchesRequireConstraint(cell, selector) {
  if (selector.baseJob && cell.baseJob !== selector.baseJob) return false;
  if (!cell.axes) return false;
  return Object.entries(selector.axes).every(
    ([key, value]) => cell.axes?.[key] === value
  );
}
function recommendMatrix(report, options = {}) {
  if (!report.cells.length) {
    throw new Error("no matrix cells were observed");
  }
  const maxStrength = options.maxStrength ?? 2;
  if (!Number.isInteger(maxStrength) || maxStrength < 1 || maxStrength > 4) {
    throw new Error("maxStrength must be an integer from 1 to 4");
  }
  const optimizerMode = options.optimizer ?? "auto";
  if (!["auto", "exact", "greedy"].includes(optimizerMode)) {
    throw new Error("optimizer must be auto, exact, or greedy");
  }
  const exactMaxNodes = options.exactMaxNodes ?? 25e4;
  if (!Number.isInteger(exactMaxNodes) || exactMaxNodes < 1) {
    throw new Error("exactMaxNodes must be a positive integer");
  }
  const knownRuntimes = report.cells.map((cell) => cell.medianRuntimeSeconds).filter((value) => value !== null);
  const fallbackCost = median3(knownRuntimes) ?? 1;
  const failureCoverage = /* @__PURE__ */ new Map();
  for (const observation of report.observations) {
    const set = failureCoverage.get(observation.cell) ?? /* @__PURE__ */ new Set();
    set.add(observation.fingerprint);
    failureCoverage.set(observation.cell, set);
  }
  const combinatorial = observedCombinatorialCoverage(
    report.cells,
    maxStrength
  );
  const constraints = options.constraints ?? EMPTY_CONSTRAINTS;
  const cellsByName = new Map(report.cells.map((cell) => [cell.cell, cell]));
  const keepCells = [...new Set(constraints.keep)];
  const keepRequirements = keepCells.map((cell, index) => {
    if (!cellsByName.has(cell)) {
      throw new Error(
        `hard keep constraint references an unobserved matrix cell: ${cell}`
      );
    }
    return {
      cell,
      token: `constraint:keep:${index}`
    };
  });
  const requireRequirements = constraints.require.map((selector, index) => {
    const matches = report.cells.filter((cell) => matchesRequireConstraint(cell, selector)).map((cell) => cell.cell);
    if (!matches.length) {
      const base = selector.baseJob ? ` baseJob=${selector.baseJob}` : "";
      const axes = Object.entries(selector.axes).map(([key, value]) => `${key}=${value}`).join(",");
      throw new Error(
        `hard require constraint matched no observed matrix cells:${base} axes=${axes}`
      );
    }
    return {
      token: `constraint:require:${index}`,
      matches: new Set(matches)
    };
  });
  const constraintTokens = [
    ...keepRequirements.map((item) => item.token),
    ...requireRequirements.map((item) => item.token)
  ];
  const anchors = new Set(report.cells.map((cell) => `base:${cell.baseJob}`));
  const failureTokens = report.clusters.map(
    (cluster) => `failure:${cluster.fingerprint}`
  );
  const combinatorialTokens = combinatorial.tokens.map((token) => token.id);
  const unresolvedSafetyTokens = combinatorial.unresolvedCells.map(
    (cell) => `unresolved:${cell}`
  );
  const unresolvedSafetyCells = new Set(combinatorial.unresolvedCells);
  const universe = /* @__PURE__ */ new Set([
    ...anchors,
    ...failureTokens,
    ...combinatorialTokens,
    ...unresolvedSafetyTokens,
    ...constraintTokens
  ]);
  const coverageByCell = /* @__PURE__ */ new Map();
  for (const cell of report.cells) {
    const coverage = /* @__PURE__ */ new Set([`base:${cell.baseJob}`]);
    for (const fingerprint2 of failureCoverage.get(cell.cell) ?? []) {
      coverage.add(`failure:${fingerprint2}`);
    }
    for (const token of combinatorial.byCell.get(cell.cell) ?? []) {
      coverage.add(token);
    }
    if (unresolvedSafetyCells.has(cell.cell)) {
      coverage.add(`unresolved:${cell.cell}`);
    }
    for (const requirement of keepRequirements) {
      if (requirement.cell === cell.cell) {
        coverage.add(requirement.token);
      }
    }
    for (const requirement of requireRequirements) {
      if (requirement.matches.has(cell.cell)) {
        coverage.add(requirement.token);
      }
    }
    coverageByCell.set(cell.cell, coverage);
  }
  const solverCandidates = report.cells.map((cell) => ({
    id: cell.cell,
    cost: costFor(cell, fallbackCost),
    covers: coverageByCell.get(cell.cell) ?? /* @__PURE__ */ new Set()
  }));
  const greedySolution = greedyWeightedSetCover(solverCandidates, universe);
  let selectedSolution = greedySolution;
  let algorithm = "greedy-weighted-set-cover";
  let optimizerOptimal = optimizerMode === "greedy" ? null : false;
  let optimizerSearchNodes = 0;
  let optimizerFallbackReason;
  if (optimizerMode !== "greedy") {
    const exact = exactWeightedSetCover(solverCandidates, universe, {
      maxNodes: exactMaxNodes,
      initial: greedySolution
    });
    optimizerSearchNodes = exact.searchNodes;
    if (exact.optimal) {
      selectedSolution = exact;
      algorithm = "exact-branch-and-bound";
      optimizerOptimal = true;
    } else if (optimizerMode === "exact") {
      throw new Error(
        `exact optimizer exceeded node budget (${exactMaxNodes}) before proving optimality`
      );
    } else {
      optimizerFallbackReason = `Exact optimizer exceeded node budget (${exactMaxNodes}); using deterministic greedy fallback.`;
    }
  }
  const selected = selectedSolution.selected.map((cell) => {
    const match = cellsByName.get(cell);
    if (!match) {
      throw new Error(`optimizer selected unknown matrix cell: ${cell}`);
    }
    return match;
  });
  const optimizerImprovementPercent = greedySolution.cost > 0 ? (1 - selectedSolution.cost / greedySolution.cost) * 100 : 0;
  const selectedNames = new Set(selected.map((cell) => cell.cell));
  const coveredFailures = /* @__PURE__ */ new Set();
  const coveredCombinations = /* @__PURE__ */ new Set();
  const coveredConstraints = /* @__PURE__ */ new Set();
  for (const observation of report.observations) {
    if (selectedNames.has(observation.cell)) {
      coveredFailures.add(observation.fingerprint);
    }
  }
  for (const cell of selected) {
    for (const token of combinatorial.byCell.get(cell.cell) ?? []) {
      coveredCombinations.add(token);
    }
    for (const token of coverageByCell.get(cell.cell) ?? []) {
      if (constraintTokens.includes(token)) {
        coveredConstraints.add(token);
      }
    }
  }
  const currentKnown = report.cells.every(
    (cell) => cell.medianRuntimeSeconds !== null
  );
  const selectedKnown = selected.every(
    (cell) => cell.medianRuntimeSeconds !== null
  );
  const currentEstimatedSeconds = currentKnown ? report.cells.reduce((sum, cell) => sum + cell.medianRuntimeSeconds, 0) : null;
  const selectedEstimatedSeconds = selectedKnown ? selected.reduce((sum, cell) => sum + cell.medianRuntimeSeconds, 0) : null;
  const reduction = currentEstimatedSeconds !== null && selectedEstimatedSeconds !== null && currentEstimatedSeconds > 0 ? (1 - selectedEstimatedSeconds / currentEstimatedSeconds) * 100 : null;
  const pricing = estimatePricing(
    report,
    selected.map((cell) => cell.cell)
  );
  const pricingCoverage = pricing.currentCells ? pricing.pricedCells / pricing.currentCells : 0;
  const currentEstimatedListPriceUsdPerRun = pricing.currentRateCardUsdPerRun;
  const selectedEstimatedListPriceUsdPerRun = pricing.selectedRateCardUsdPerRun;
  const estimatedListPriceReductionPercent = pricing.rateCardReductionPercent;
  const projectedRunsPer30Days = pricing.projectedRunsPer30Days;
  const currentProjectedListPriceUsd30Days = pricing.currentRateCardUsdPer30Days;
  const selectedProjectedListPriceUsd30Days = pricing.selectedRateCardUsdPer30Days;
  const failureRuns = new Set(report.observations.map((item) => item.runId)).size;
  const eventCountsByJob = /* @__PURE__ */ new Map();
  for (const item of report.observations) {
    eventCountsByJob.set(
      item.jobId,
      (eventCountsByJob.get(item.jobId) ?? 0) + 1
    );
  }
  const multiEventJobs = [...eventCountsByJob.values()].filter(
    (count) => count > 1
  ).length;
  const warnings = [
    "Historical failure coverage does not guarantee detection of unseen future failures.",
    `Combinatorial coverage preserves observed axis combinations up to strength ${maxStrength}; it does not invent combinations absent from the observed matrix.`,
    "Runtime estimates come from matrix jobs observed across completed workflow runs."
  ];
  if (optimizerFallbackReason) {
    warnings.push(optimizerFallbackReason);
  }
  if (constraintTokens.length) {
    warnings.push(
      `Applied ${constraintTokens.length} explicit hard constraint(s): keep=${keepRequirements.length}, require=${requireRequirements.length}.`
    );
  }
  if (pricingCoverage < 1) {
    warnings.push(
      `Billing classification could be resolved for ${pricing.pricedCells}/${pricing.currentCells} cells; aggregate monetary estimates are omitted unless coverage is complete.`
    );
  }
  if (!report.fingerprints) {
    warnings.unshift(
      "No analyzable failure fingerprints were observed; selection is based on combinatorial coverage and runtime only."
    );
  } else if (failureRuns < 5) {
    warnings.unshift(
      `Evidence is sparse: only ${failureRuns} workflow run(s) with analyzable matrix failures contributed failure evidence.`
    );
  }
  if (combinatorial.unresolvedCells.length) {
    warnings.push(
      `Axis values could not be resolved for ${combinatorial.unresolvedCells.length} cell(s); those cells are retained individually as a safety constraint.`
    );
  }
  if (report.expiredLogs || report.logErrors) {
    warnings.push(
      `Some failed logs were unavailable (expired=${report.expiredLogs}, errors=${report.logErrors}); failure coverage only includes analyzed logs.`
    );
  }
  if (report.workflowDefinitionFallbacks) {
    warnings.push(
      `Historical workflow YAML could not be read for ${report.workflowDefinitionFallbacks} revision(s); those runs used the default-branch workflow definition as a fallback.`
    );
  }
  if (report.workflowDefinitionErrors) {
    warnings.push(
      `Workflow definitions were unavailable for ${report.workflowDefinitionErrors} revision(s); matrix jobs from those revisions may be missing from the analysis.`
    );
  }
  if (report.workflowRenderCoverage !== void 0 && report.workflowRenderCoverage !== null && report.workflowRenderCoverage < 1) {
    warnings.push(
      `Only ${(report.workflowRenderCoverage * 100).toFixed(1)}% of static workflow matrix cells had renderable job names; recommendation coverage may be incomplete.`
    );
  }
  if (report.workflowMatchCoverage !== void 0 && report.workflowMatchCoverage !== null && report.workflowMatchCoverage < 1) {
    warnings.push(
      `Only ${(report.workflowMatchCoverage * 100).toFixed(1)}% of expected static matrix cells matched actual GitHub job names; recommendation coverage may be incomplete.`
    );
  }
  if (report.dynamicMatrixDefinitions) {
    warnings.push(
      `${report.dynamicMatrixDefinitions} dynamic matrix definition(s) could not be statically expanded; observed jobs are still analyzed when they can be identified, but axis coverage may be incomplete when runtime values cannot be recovered safely.`
    );
  }
  if (report.captureEvidenceCandidates && (report.captureEvidenceJobs ?? 0) < report.captureEvidenceCandidates) {
    warnings.push(
      `Runtime matrix evidence recovered ${report.captureEvidenceJobs ?? 0}/${report.captureEvidenceCandidates} opted-in unresolved job(s); missing evidence remains unresolved.`
    );
  }
  if (report.captureEvidenceErrors) {
    warnings.push(
      `${report.captureEvidenceErrors} runtime matrix evidence lookup(s) failed or were conflicting; verify checks: read permission and capture-step execution.`
    );
  }
  return {
    mode: "history+combinatorial",
    algorithm,
    optimizerMode,
    optimizerOptimal,
    optimizerSearchNodes,
    ...optimizerFallbackReason ? { optimizerFallbackReason } : {},
    greedyObjectiveCost: greedySolution.cost,
    selectedObjectiveCost: selectedSolution.cost,
    optimizerImprovementPercent,
    coverageStrength: maxStrength,
    currentCells: report.cells.length,
    selectedCells: selected.map((cell) => ({
      cell: cell.cell,
      baseJob: cell.baseJob,
      medianRuntimeSeconds: cell.medianRuntimeSeconds,
      runnerLabels: cell.runnerLabels,
      estimatedListPriceUsdPerRun: standardRunnerListPriceUsd(
        cell.medianRuntimeSeconds,
        cell.runnerLabels
      ),
      coveredFailures: (failureCoverage.get(cell.cell) ?? /* @__PURE__ */ new Set()).size,
      coveredCombinations: (combinatorial.byCell.get(cell.cell) ?? /* @__PURE__ */ new Set()).size
    })),
    historicalFingerprints: report.fingerprints,
    coveredFingerprints: coveredFailures.size,
    historicalRecall: report.fingerprints ? coveredFailures.size / report.fingerprints : null,
    failureEvents: report.observations.length,
    failedJobsWithEvents: eventCountsByJob.size,
    multiEventJobs,
    combinatorialRequirements: combinatorial.tokens.length,
    coveredCombinatorialRequirements: coveredCombinations.size,
    combinatorialCoverage: combinatorial.tokens.length ? coveredCombinations.size / combinatorial.tokens.length : null,
    unresolvedAxisCells: combinatorial.unresolvedCells,
    currentEstimatedSeconds,
    selectedEstimatedSeconds,
    estimatedComputeReductionPercent: reduction,
    pricingCoverage,
    currentEstimatedListPriceUsdPerRun,
    selectedEstimatedListPriceUsdPerRun,
    estimatedListPriceReductionPercent,
    projectedRunsPer30Days,
    currentProjectedListPriceUsd30Days,
    selectedProjectedListPriceUsd30Days,
    pricing,
    constraintRequirements: constraintTokens.length,
    coveredConstraintRequirements: coveredConstraints.size,
    keptCells: keepRequirements.map((item) => item.cell),
    requiredSelectors: requireRequirements.length,
    warnings
  };
}

// src/backtest.ts
function clustersFor(observations) {
  const byFingerprint = /* @__PURE__ */ new Map();
  for (const item of observations) {
    const list = byFingerprint.get(item.fingerprint) ?? [];
    list.push(item);
    byFingerprint.set(item.fingerprint, list);
  }
  return [...byFingerprint.entries()].map(([fingerprint2, items]) => ({
    fingerprint: fingerprint2,
    signature: items[0].signature,
    cells: [...new Set(items.map((item) => item.cell))].sort(),
    observations: items.length
  }));
}
function subsetReport(source, observations, runIds) {
  const clusters = clustersFor(observations);
  const byCell = /* @__PURE__ */ new Map();
  for (const item of observations) {
    const list = byCell.get(item.cell) ?? [];
    list.push(item);
    byCell.set(item.cell, list);
  }
  const matrixJobs = source.matrixJobs.filter((item) => runIds.has(item.runId));
  const cells = summarizeCells(matrixJobs, observations);
  return {
    ...source,
    runsAnalyzed: runIds.size,
    failedJobs: new Set(observations.map((item) => item.jobId)).size,
    fingerprints: clusters.length,
    cells,
    clusters,
    observations,
    matrixJobs
  };
}
function backtestRecommendation(report, holdoutPercent = 25, coverageStrength = 2, constraints, optimizerOptions = {}) {
  if (holdoutPercent <= 0 || holdoutPercent >= 100) {
    throw new Error("holdoutPercent must be between 0 and 100");
  }
  const conclusive = (value) => value === void 0 || ["success", "failure", "timed_out", "neutral"].includes(value ?? "");
  const runs = [
    ...new Map(
      report.matrixJobs.filter((item) => conclusive(item.runConclusion)).map((item) => [
        item.runId,
        { runId: item.runId, runNumber: item.runNumber }
      ])
    ).values()
  ].sort((a, b) => a.runNumber - b.runNumber || a.runId - b.runId);
  if (runs.length < 2) {
    throw new Error(
      "backtest requires at least two completed matrix workflow runs"
    );
  }
  const holdoutCount = Math.max(
    1,
    Math.min(runs.length - 1, Math.ceil(runs.length * holdoutPercent / 100))
  );
  const split = runs.length - holdoutCount;
  const trainingRunIds = new Set(runs.slice(0, split).map((run) => run.runId));
  const holdoutRunIds = new Set(runs.slice(split).map((run) => run.runId));
  const training = report.observations.filter(
    (item) => trainingRunIds.has(item.runId)
  );
  const holdout = report.observations.filter(
    (item) => holdoutRunIds.has(item.runId)
  );
  if (!training.length || !holdout.length) {
    throw new Error(
      "backtest needs at least one analyzable failure in both the training and holdout windows"
    );
  }
  const trainingReport = subsetReport(report, training, trainingRunIds);
  const holdoutReport = subsetReport(report, holdout, holdoutRunIds);
  const recommendation = recommendMatrix(trainingReport, {
    maxStrength: coverageStrength,
    constraints,
    ...optimizerOptions
  });
  const selected = new Set(
    recommendation.selectedCells.map((cell) => cell.cell)
  );
  const trainingFingerprints = new Set(
    training.map((item) => item.fingerprint)
  );
  const holdoutClusters = clustersFor(holdout);
  const holdoutCombinatorial = observedCombinatorialCoverage(
    holdoutReport.cells,
    coverageStrength
  );
  const coveredHoldoutCombinations = /* @__PURE__ */ new Set();
  for (const cell of holdoutReport.cells) {
    if (!selected.has(cell.cell)) continue;
    for (const token of holdoutCombinatorial.byCell.get(cell.cell) ?? []) {
      coveredHoldoutCombinations.add(token);
    }
  }
  let covered = 0;
  let unseen = 0;
  let coveredUnseen = 0;
  const missed = [];
  for (const cluster of holdoutClusters) {
    const detected = cluster.cells.some((cell) => selected.has(cell));
    const seenInTraining = trainingFingerprints.has(cluster.fingerprint);
    if (detected) covered++;
    if (!seenInTraining) {
      unseen++;
      if (detected) coveredUnseen++;
    }
    if (!detected) {
      missed.push({
        fingerprint: cluster.fingerprint,
        signature: cluster.signature,
        detectingCells: cluster.cells,
        seenInTraining
      });
    }
  }
  const warnings = [
    "Backtesting uses only runs with analyzable failed job logs for failure recall.",
    "Runtime costs and combinatorial constraints are computed from the training window only.",
    `Observed combinatorial coverage is preserved up to strength ${coverageStrength}.`
  ];
  if (recommendation.optimizerFallbackReason) {
    warnings.push(recommendation.optimizerFallbackReason);
  }
  if (recommendation.constraintRequirements) {
    warnings.push(
      `Applied ${recommendation.constraintRequirements} explicit hard constraint(s) to the training recommendation.`
    );
  }
  return {
    mode: "time-holdout",
    holdoutPercent,
    coverageStrength,
    trainingRuns: trainingRunIds.size,
    holdoutRuns: holdoutRunIds.size,
    selectedCells: [...selected],
    optimizerAlgorithm: recommendation.algorithm,
    optimizerOptimal: recommendation.optimizerOptimal,
    optimizerSearchNodes: recommendation.optimizerSearchNodes,
    trainingFingerprints: trainingFingerprints.size,
    holdoutFingerprints: holdoutClusters.length,
    coveredHoldoutFingerprints: covered,
    holdoutRecall: holdoutClusters.length ? covered / holdoutClusters.length : 0,
    unseenHoldoutFingerprints: unseen,
    coveredUnseenHoldoutFingerprints: coveredUnseen,
    unseenHoldoutRecall: unseen ? coveredUnseen / unseen : null,
    holdoutCombinatorialRequirements: holdoutCombinatorial.tokens.length,
    coveredHoldoutCombinatorialRequirements: coveredHoldoutCombinations.size,
    holdoutCombinatorialCoverage: holdoutCombinatorial.tokens.length ? coveredHoldoutCombinations.size / holdoutCombinatorial.tokens.length : null,
    missed,
    warnings
  };
}

// src/optimization-pr.ts
var import_node_path = require("node:path");

// src/rewrite.ts
var import_yaml3 = __toESM(require_dist(), 1);
function assertMutationSafe(workflowText, observedCells, selectedCells) {
  const definitions = workflowMatrixDefinitions(workflowText);
  if (!definitions.length) {
    throw new Error("workflow contains no static matrix definitions");
  }
  const dynamic = definitions.filter((definition) => definition.dynamic);
  if (dynamic.length) {
    throw new Error(
      `cannot rewrite dynamic matrix job(s): ${dynamic.map((item) => item.jobId).join(", ")}`
    );
  }
  const currentNames = new Set(
    definitions.flatMap(
      (definition) => definition.cells.map((cell) => cell.name)
    )
  );
  const unseenCurrent = [...currentNames].filter(
    (name) => !observedCells.has(name)
  );
  if (unseenCurrent.length) {
    throw new Error(
      `cannot rewrite because ${unseenCurrent.length} current matrix cell(s) were not observed in the analyzed history`
    );
  }
  const selectedOutsideCurrent = [...selectedCells].filter(
    (name) => !currentNames.has(name)
  );
  if (selectedOutsideCurrent.length) {
    throw new Error(
      `cannot rewrite because recommendation contains ${selectedOutsideCurrent.length} historical cell(s) not present in the current workflow`
    );
  }
  return definitions;
}
function rewriteWorkflowToSelectedCells(workflowText, observedCellNames, selectedCellNames) {
  const observedCells = new Set(observedCellNames);
  const selectedCells = new Set(selectedCellNames);
  const definitions = assertMutationSafe(
    workflowText,
    observedCells,
    selectedCells
  );
  const document = (0, import_yaml3.parseDocument)(workflowText, {
    keepSourceTokens: true
  });
  if (document.errors.length) {
    throw new Error(
      `workflow YAML could not be parsed safely: ${document.errors[0].message}`
    );
  }
  const jobs = [];
  for (const definition of definitions) {
    const selected = definition.cells.filter(
      (cell) => selectedCells.has(cell.name)
    );
    if (!selected.length) {
      throw new Error(
        `cannot remove every matrix cell from job ${definition.jobId}`
      );
    }
    if (selected.length === definition.cells.length) continue;
    const include = selected.map((cell) => cell.matrix);
    document.setIn(["jobs", definition.jobId, "strategy", "matrix"], {
      include
    });
    jobs.push({
      jobId: definition.jobId,
      beforeCells: definition.cells.length,
      afterCells: selected.length
    });
  }
  if (!jobs.length) {
    return { changed: false, workflow: workflowText, jobs: [] };
  }
  const rewritten = document.toString({
    lineWidth: 0
  });
  const rewrittenDefinitions = workflowMatrixDefinitions(rewritten);
  for (const job of jobs) {
    const before = definitions.find((item) => item.jobId === job.jobId);
    const after = rewrittenDefinitions.find((item) => item.jobId === job.jobId);
    if (!after || after.dynamic) {
      throw new Error(
        `rewritten matrix for job ${job.jobId} could not be verified`
      );
    }
    const expected = before.cells.filter((cell) => selectedCells.has(cell.name)).map((cell) => cell.name).sort();
    const actual = after.cells.map((cell) => cell.name).sort();
    if (expected.length !== actual.length || expected.some((name, index) => name !== actual[index])) {
      throw new Error(
        `rewritten matrix for job ${job.jobId} did not round-trip to the selected cells`
      );
    }
  }
  return {
    changed: true,
    workflow: rewritten,
    jobs
  };
}

// src/optimization-pr.ts
function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "workflow";
}
function optimizationBranch(workflowPath) {
  return `matrixtrim/optimize-${slug((0, import_node_path.basename)(workflowPath))}`;
}
function optimizationSafetyReason(analysis, recommendation, backtest) {
  if (!analysis.workflowPath) {
    return "workflow path could not be resolved";
  }
  if (recommendation.selectedCells.length >= recommendation.currentCells) {
    return "recommendation does not reduce the observed matrix";
  }
  if (analysis.dynamicMatrixDefinitions) {
    return "dynamic matrix definitions are present";
  }
  if (analysis.workflowDefinitionErrors) {
    return "one or more historical workflow definitions were unavailable";
  }
  if (analysis.workflowRenderCoverage !== null && analysis.workflowRenderCoverage !== void 0 && analysis.workflowRenderCoverage < 1) {
    return "not every static matrix cell has a renderable job name";
  }
  if (analysis.workflowMatchCoverage !== null && analysis.workflowMatchCoverage !== void 0 && analysis.workflowMatchCoverage < 1) {
    return "not every expected static matrix cell matched an observed GitHub job";
  }
  if (recommendation.unresolvedAxisCells.length) {
    return "one or more observed matrix cells have unresolved axes";
  }
  if (recommendation.historicalRecall !== null && recommendation.historicalRecall < 1) {
    return "historical failure recall is below 100%";
  }
  if (recommendation.combinatorialCoverage !== null && recommendation.combinatorialCoverage < 1) {
    return "combinatorial coverage is below 100%";
  }
  if (recommendation.coveredConstraintRequirements < recommendation.constraintRequirements) {
    return "one or more explicit hard constraints are not satisfied";
  }
  if (recommendation.optimizerMode === "auto" && recommendation.optimizerOptimal === false) {
    return "exact optimizer did not prove optimality within the node budget";
  }
  if (backtest && backtest.holdoutRecall < 1) {
    return "holdout failure recall is below 100%";
  }
  if (backtest?.unseenHoldoutRecall !== null && backtest?.unseenHoldoutRecall !== void 0 && backtest.unseenHoldoutRecall < 1) {
    return "unseen-failure recall is below 100%";
  }
  if (backtest?.holdoutCombinatorialCoverage !== null && backtest?.holdoutCombinatorialCoverage !== void 0 && backtest.holdoutCombinatorialCoverage < 1) {
    return "holdout combinatorial coverage is below 100%";
  }
  return null;
}
function optimizationPullRequestBody(rewrite, recommendation, backtest, backtestError) {
  const jobs = rewrite.jobs.map(
    (job) => `- \`${job.jobId}\`: ${job.beforeCells} \u2192 ${job.afterCells} cells`
  ).join("\n");
  const holdout = backtest ? `${(backtest.holdoutRecall * 100).toFixed(1)}%` : `not available${backtestError ? ` (${backtestError})` : ""}`;
  const unseen = backtest?.unseenHoldoutRecall === null || backtest?.unseenHoldoutRecall === void 0 ? "n/a" : `${(backtest.unseenHoldoutRecall * 100).toFixed(1)}%`;
  return `<!-- matrixtrim-optimization-pr -->
## MatrixTrim optimization proposal

This **draft PR** converts the selected static matrix cells to explicit \`matrix.include\` rows. It is intentionally not auto-merged.

### Changes

${jobs}

### Evidence

- Optimizer: ${recommendation.algorithm} (mode=${recommendation.optimizerMode}, optimal=${recommendation.optimizerOptimal ?? "n/a"}, nodes=${recommendation.optimizerSearchNodes})
- Optimizer improvement vs greedy: ${recommendation.optimizerImprovementPercent.toFixed(1)}%
- Historical failure recall: ${recommendation.historicalRecall === null ? "n/a" : `${(recommendation.historicalRecall * 100).toFixed(1)}%`}
- Observed combinatorial coverage: ${recommendation.combinatorialCoverage === null ? "n/a" : `${(recommendation.combinatorialCoverage * 100).toFixed(1)}%`}
- Explicit hard constraints: ${recommendation.coveredConstraintRequirements}/${recommendation.constraintRequirements}
- Holdout failure recall: ${holdout}
- Unseen-failure recall: ${unseen}
- Estimated compute reduction: ${recommendation.estimatedComputeReductionPercent === null ? "n/a" : `${recommendation.estimatedComputeReductionPercent.toFixed(1)}%`}
- Standard-runner rate-card reduction: ${recommendation.estimatedListPriceReductionPercent === null ? "n/a" : `${recommendation.estimatedListPriceReductionPercent.toFixed(1)}%`}

### Safety

MatrixTrim only creates this PR when the current workflow is a fully resolved static matrix, every current cell was observed in the analyzed history, historical and combinatorial coverage are preserved, and any available holdout checks pass at 100%.

Review and run the repository's normal CI before merging.
`;
}
async function createOrUpdateOptimizationPullRequest(client, analysis, recommendation, backtest, backtestError) {
  const reason = optimizationSafetyReason(analysis, recommendation, backtest);
  if (reason) {
    return { status: "skipped", reason };
  }
  const repository = await client.repositoryInfo();
  const base = repository.default_branch;
  if (!base) {
    return {
      status: "skipped",
      reason: "repository default branch is unavailable"
    };
  }
  const workflowPath = analysis.workflowPath;
  const baseFile = await client.file(workflowPath, base);
  const rewrite = rewriteWorkflowToSelectedCells(
    baseFile.text,
    analysis.cells.map((cell) => cell.cell),
    recommendation.selectedCells.map((cell) => cell.cell)
  );
  if (!rewrite.changed) {
    return {
      status: "skipped",
      reason: "current workflow already matches the recommendation",
      rewrite
    };
  }
  const baseSha = await client.refSha(base);
  if (!baseSha) {
    return { status: "skipped", reason: "default branch ref is unavailable" };
  }
  const branch = optimizationBranch(workflowPath);
  const existing = await client.listOpenPullRequests(branch, base);
  if (existing[0] && existing[0].draft === false) {
    return {
      status: "skipped",
      branch,
      number: existing[0].number,
      url: existing[0].html_url,
      reason: "existing MatrixTrim pull request is no longer a draft; automatic updates are disabled",
      rewrite
    };
  }
  const branchSha = await client.refSha(branch);
  if (branchSha) {
    await client.updateBranch(branch, baseSha);
  } else {
    await client.createBranch(branch, baseSha);
  }
  const branchFile = await client.file(workflowPath, branch);
  await client.updateFile(
    workflowPath,
    branch,
    branchFile.sha,
    rewrite.workflow,
    "Optimize CI matrix with MatrixTrim"
  );
  const title = "MatrixTrim: propose CI matrix reduction";
  const body = optimizationPullRequestBody(
    rewrite,
    recommendation,
    backtest,
    backtestError
  );
  let pull;
  let status;
  if (existing[0]) {
    pull = await client.updatePullRequest(existing[0].number, title, body);
    status = "updated";
  } else {
    pull = await client.createPullRequest(title, branch, base, body);
    status = "created";
  }
  return {
    status,
    branch,
    number: pull.number,
    url: pull.html_url,
    rewrite
  };
}

// src/action.ts
function inferWorkflowFile(repository) {
  const ref = process.env.GITHUB_WORKFLOW_REF;
  if (!ref) return void 0;
  const prefix = `${repository}/`;
  const pathWithRef = ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
  const at = pathWithRef.indexOf("@");
  const path = at >= 0 ? pathWithRef.slice(0, at) : pathWithRef;
  return path ? (0, import_node_path2.basename)(path) : void 0;
}
async function eventPullRequestNumber() {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) return void 0;
  try {
    const event = JSON.parse(await (0, import_promises.readFile)(path, "utf8"));
    return event.pull_request?.number ?? (event.issue?.pull_request ? event.issue.number : void 0) ?? event.number;
  } catch {
    return void 0;
  }
}
async function writeOutput(name, value) {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) return;
  await (0, import_promises.appendFile)(path, `${name}=${value}
`, "utf8");
}
function warning(message) {
  console.log(`::warning::${message.replace(/\r?\n/g, " ")}`);
}
function notice(message) {
  console.log(`::notice title=MatrixTrim evidence::${message}`);
}
async function main() {
  const mode = actionInput("mode") || "analyze";
  if (!["analyze", "capture"].includes(mode)) {
    throw new Error("mode must be analyze or capture");
  }
  if (mode === "capture") {
    const matrixJson = actionInput("matrix");
    if (!matrixJson)
      throw new Error("matrix input is required in capture mode");
    const evidence = encodeMatrixEvidence(
      process.env.GITHUB_JOB ?? "",
      matrixJson
    );
    notice(evidence);
    await writeOutput("capture-status", "captured");
    return;
  }
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("GITHUB_REPOSITORY is not available");
  const token = actionInput("token") || process.env.GITHUB_TOKEN || "";
  if (!token) throw new Error("token input or GITHUB_TOKEN is required");
  const workflow = actionInput("workflow") || inferWorkflowFile(repository);
  const limit = intActionInput("limit", 100, 2, 500);
  const holdout = intActionInput("holdout", 25, 5, 50);
  const strength = intActionInput("strength", 2, 1, 4);
  const optimizerRaw = actionInput("optimizer") || "auto";
  if (!["auto", "exact", "greedy"].includes(optimizerRaw)) {
    throw new Error("optimizer must be auto, exact, or greedy");
  }
  const optimizer = optimizerRaw;
  const exactMaxNodes = intActionInput(
    "exact-max-nodes",
    25e4,
    1,
    1e7
  );
  const configPath = actionInput("config") || ".matrixtrim.yml";
  const comment = boolActionInput("comment", true);
  const createPr = boolActionInput("create-pr", false);
  const github = new GitHubClient(repository, token);
  const config = await loadRepositoryConfig(
    github,
    configPath,
    configPath !== ".matrixtrim.yml"
  );
  console.log(
    `MatrixTrim: repository=${repository}, workflow=${workflow ?? "all"}, limit=${limit}, strength=${strength}, optimizer=${optimizer}, exactMaxNodes=${exactMaxNodes}, constraints=${(config?.constraints.keep.length ?? 0) + (config?.constraints.require.length ?? 0)}`
  );
  const analysis = await analyzeRepository(repository, {
    limit,
    workflow,
    token
  });
  const recommendation = recommendMatrix(analysis, {
    maxStrength: strength,
    constraints: config?.constraints,
    optimizer,
    exactMaxNodes
  });
  let backtest = null;
  let backtestError;
  try {
    backtest = backtestRecommendation(
      analysis,
      holdout,
      strength,
      config?.constraints,
      {
        optimizer,
        exactMaxNodes
      }
    );
  } catch (error) {
    backtestError = error.message;
    warning(`backtest unavailable: ${backtestError}`);
  }
  const report = formatActionReport(
    repository,
    workflow,
    recommendation,
    backtest,
    backtestError
  );
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await (0, import_promises.appendFile)(summaryPath, report + "\n", "utf8");
  } else {
    console.log(report);
  }
  await writeOutput(
    "capture-evidence-candidates",
    analysis.captureEvidenceCandidates ?? 0
  );
  await writeOutput("capture-evidence-jobs", analysis.captureEvidenceJobs ?? 0);
  await writeOutput(
    "capture-evidence-errors",
    analysis.captureEvidenceErrors ?? 0
  );
  await writeOutput("current-cells", recommendation.currentCells);
  await writeOutput("selected-cells", recommendation.selectedCells.length);
  await writeOutput("optimizer-algorithm", recommendation.algorithm);
  await writeOutput(
    "optimizer-optimal",
    recommendation.optimizerOptimal === null ? "" : String(recommendation.optimizerOptimal)
  );
  await writeOutput(
    "optimizer-search-nodes",
    recommendation.optimizerSearchNodes
  );
  await writeOutput(
    "optimizer-improvement-percent",
    recommendation.optimizerImprovementPercent.toFixed(1)
  );
  await writeOutput(
    "optimizer-fallback-reason",
    recommendation.optimizerFallbackReason ?? ""
  );
  await writeOutput(
    "compute-reduction-percent",
    recommendation.estimatedComputeReductionPercent?.toFixed(1) ?? ""
  );
  await writeOutput(
    "pricing-coverage",
    recommendation.pricingCoverage.toFixed(4)
  );
  await writeOutput(
    "rate-card-usd-per-run-current",
    recommendation.currentEstimatedListPriceUsdPerRun?.toFixed(4) ?? ""
  );
  await writeOutput(
    "rate-card-usd-per-run-selected",
    recommendation.selectedEstimatedListPriceUsdPerRun?.toFixed(4) ?? ""
  );
  await writeOutput(
    "rate-card-reduction-percent",
    recommendation.estimatedListPriceReductionPercent?.toFixed(1) ?? ""
  );
  await writeOutput(
    "projected-30d-rate-card-usd-current",
    recommendation.currentProjectedListPriceUsd30Days?.toFixed(2) ?? ""
  );
  await writeOutput(
    "projected-30d-rate-card-usd-selected",
    recommendation.selectedProjectedListPriceUsd30Days?.toFixed(2) ?? ""
  );
  await writeOutput(
    "repository-visibility",
    recommendation.pricing.repositoryVisibility ?? ""
  );
  await writeOutput(
    "estimated-charge-usd-per-run-current",
    recommendation.pricing.currentEstimatedChargeUsdPerRun?.toFixed(4) ?? ""
  );
  await writeOutput(
    "estimated-charge-usd-per-run-selected",
    recommendation.pricing.selectedEstimatedChargeUsdPerRun?.toFixed(4) ?? ""
  );
  await writeOutput(
    "estimated-charge-reduction-percent",
    recommendation.pricing.estimatedChargeReductionPercent?.toFixed(1) ?? ""
  );
  await writeOutput(
    "projected-30d-estimated-charge-usd-current",
    recommendation.pricing.currentEstimatedChargeUsdPer30Days?.toFixed(2) ?? ""
  );
  await writeOutput(
    "projected-30d-estimated-charge-usd-selected",
    recommendation.pricing.selectedEstimatedChargeUsdPer30Days?.toFixed(2) ?? ""
  );
  await writeOutput(
    "historical-recall",
    recommendation.historicalRecall?.toFixed(4) ?? ""
  );
  await writeOutput("failure-events", recommendation.failureEvents);
  await writeOutput(
    "failed-jobs-with-events",
    recommendation.failedJobsWithEvents
  );
  await writeOutput("multi-event-jobs", recommendation.multiEventJobs);
  await writeOutput(
    "combinatorial-coverage",
    recommendation.combinatorialCoverage?.toFixed(4) ?? ""
  );
  await writeOutput(
    "constraint-requirements",
    recommendation.constraintRequirements
  );
  await writeOutput(
    "constraint-coverage",
    recommendation.constraintRequirements ? (recommendation.coveredConstraintRequirements / recommendation.constraintRequirements).toFixed(4) : "1.0000"
  );
  await writeOutput("holdout-recall", backtest?.holdoutRecall.toFixed(4) ?? "");
  await writeOutput(
    "unseen-failure-recall",
    backtest?.unseenHoldoutRecall?.toFixed(4) ?? ""
  );
  let optimizationStatus = createPr ? "skipped" : "disabled";
  let optimizationNumber = "";
  let optimizationUrl = "";
  let optimizationReason = "";
  if (createPr) {
    const eventName = process.env.GITHUB_EVENT_NAME ?? "";
    if (eventName === "pull_request" || eventName === "pull_request_target") {
      optimizationReason = "optimization PR creation is disabled for pull-request-triggered runs";
      warning(optimizationReason);
    } else {
      try {
        const result = await createOrUpdateOptimizationPullRequest(
          github,
          analysis,
          recommendation,
          backtest,
          backtestError
        );
        optimizationStatus = result.status;
        optimizationNumber = result.number?.toString() ?? "";
        optimizationUrl = result.url ?? "";
        optimizationReason = result.reason ?? "";
        if (result.status === "created" || result.status === "updated") {
          console.log(
            `MatrixTrim optimization PR ${result.status}: ${result.url}`
          );
        } else if (result.reason) {
          warning(`optimization PR skipped: ${result.reason}`);
        }
      } catch (error) {
        optimizationStatus = "skipped";
        optimizationReason = `optimization PR failed: ${error.message}`;
        warning(optimizationReason);
      }
    }
  }
  await writeOutput("optimization-pr-status", optimizationStatus);
  await writeOutput("optimization-pr-number", optimizationNumber);
  await writeOutput("optimization-pr-url", optimizationUrl);
  await writeOutput("optimization-pr-reason", optimizationReason);
  if (summaryPath && createPr) {
    const summary = optimizationUrl ? `
### Optimization PR

- Status: **${optimizationStatus}**
- PR: ${optimizationUrl}
` : `
### Optimization PR

- Status: **${optimizationStatus}**
- Reason: ${optimizationReason || "not created"}
`;
    await (0, import_promises.appendFile)(summaryPath, summary, "utf8");
  }
  if (comment) {
    const pullRequest = await eventPullRequestNumber();
    if (pullRequest) {
      try {
        const marker = "<!-- matrixtrim-report -->";
        const comments = await github.listIssueComments(pullRequest);
        const previous = comments.find(
          (item) => item.body?.includes(marker) && (item.user?.login?.endsWith("[bot]") ?? false)
        );
        if (previous) {
          await github.updateIssueComment(previous.id, report);
          console.log(`Updated MatrixTrim comment on PR #${pullRequest}`);
        } else {
          await github.createIssueComment(pullRequest, report);
          console.log(`Created MatrixTrim comment on PR #${pullRequest}`);
        }
      } catch (error) {
        warning(
          `could not create/update PR comment: ${error.message}. Step Summary is still available.`
        );
      }
    }
  }
}
void main().catch((error) => {
  console.error(
    `::error::MatrixTrim failed: ${error.message.replace(/\r?\n/g, " ")}`
  );
  process.exitCode = 1;
});
