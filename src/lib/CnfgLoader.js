var config = {
  "CMD_PREFIX": "-/",
  "cq": {
    "httpapi":{
      "apiRoot": "http://0.0.0.0:7501"
    },
    "listen":{
      "port": 7500,
      "host": "127.0.0.1"
    }
  },
  "MSG_GP": [],
  "SCP_SITE": "cn"
}
const fs = require("fs");
const path = require('path');
let custom = JSON.parse(fs.readFileSync(path.join(__dirname,'../../data/config.json'), 'utf8'));

confignames = ["CMD_PREFIX", "MSG_GP", "SCP_SITE"];
for (name of confignames) { if (custom[name] !== undefined && custom[name]) {config[name] = custom[name]} };
if (custom.cq.httpapi!==undefined) {config.cq.httpapi=custom.cq.httpapi}
if (custom.cq.listen!==undefined) {config.cq.listen=custom.cq.listen}


module.exports = config;
