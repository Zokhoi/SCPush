const fs = require('fs');
const yaml = require('js-yaml');
const winston = require('winston');

// 用于加载配置文件
const isFileExists = (name) => {
    try {
        fs.accessSync(name, fs.constants.R_OK);
        return true;
    } catch (err) {
        return false;
    }
}

// 加载配置文件
const loadConfig = (name) => {
    // 优先读取yaml格式配置文件
    if (isFileExists(`${name}.yml`)) {
        return yaml.safeLoad(fs.readFileSync(`${name}.yml`, 'utf8'));
    } else if (isFileExists(`${name}.yaml`)) {
        return yaml.safeLoad(fs.readFileSync(`${name}.yaml`, 'utf8'));
    } else if (isFileExists(`${name}.js`)) {
        return require(`./${name}.js`);
    } else if (isFileExists(`${name}.json`)) {
        return require(`./${name}.json`);
    } else {
        return null;
    }
};

// 检查已弃用设置
const checkDeprecatedConfig = (object, path, otherWarning = '') => {
    let current = object;
    let keys = path.split('.');
    for (let key of keys) {
        if (current === null || current === undefined || current[key] === null || current[key] === undefined) {
            return;
        } else {
            current = current[key];
        }
    }
    winston.warn(`* DEPRECATED: Config ${path} is deprecated. ${otherWarning}`);
};

const branch = {
  "wl": "http://wanderers-library.wikidot.com",
  "en": "http://scp-wiki.wikidot.com",
  "ru": "http://scp-ru.wikidot.com",
  "ko": "http://scpko.wikidot.com",
  "ja": "http://scp-jp.wikidot.com",
  "jp": "http://scp-jp.wikidot.com",
  "fr": "http://fondationscp.wikidot.com",
  "es": "http://lafundacionscp.wikidot.com",
  "th": "http://scp-th.wikidot.com",
  "pl": "http://scp-pl.wikidot.com",
  "de": "http://scp-wiki-de.wikidot.com",
  "cn": "http://scp-wiki-cn.wikidot.com",
  "it": "http://fondazionescp.wikidot.com",
  "pt": "http://scp-pt-br.wikidot.com",
  "cs": "http://scp-cs.wikidot.com",
  "cz": "http://scp-cs.wikidot.com",
  "int": "http://scp-int.wikidot.com"
};


class Entry {
  constructor (key, value, now, maxAge) {
    this.key = key
    this.value = value
    this.now = now
    this.maxAge = maxAge || 0
  }
};

class SlowModeCache extends Map {
  constructor(options={max:500,maxAge:60000}) {
    super();
    if (options instanceof Number) {
      this._max = options;
    }
    if (options.max) {
      this._max = options.max;
    }
    if (options.maxAge) {
      this._maxAge = options.maxAge;
    }
  }

  set(key, value, maxAge = this._maxAge) {
    let now;
    if (this.has(key)) {
      let temp = this.get(key);
      now = temp.now
    } else {
      now = Date.now()
    }
    return super.set(key, new Entry(key, value, now, maxAge));
  }

  has (key) {
    return Boolean(this.get(key));
  }

  get (key) {
    let temp = super.get(key);
    if (temp) {
      if (temp.now+temp.maxAge<=Date.now()) {
        this.delete(key);
        return undefined;
      } else return temp.value;
    } else return undefined;
  }
}

module.exports = {
  isFileExists: isFileExists,
  loadConfig: loadConfig,
  checkDeprecatedConfig: checkDeprecatedConfig,
  branch: branch,
  SlowModeCache: SlowModeCache,
}
