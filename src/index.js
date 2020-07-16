const fs = require("fs");
const config = require('./lib/CnfgLoader');
const got = require("got");
const cheerio = require("cheerio");

const CQHTTP = require('cqhttp');
var cq = new CQHTTP(config.cq.httpapi);
//cq.listen(config.cq.listen.port, config.cq.listen.host);
console.log(`CoolQ bot posting to ${config.cq.httpapi.apiRoot}, listening on ${config.cq.listen.host}:${config.cq.listen.port}`);
cq.__config = config;

const Discord = require('discord.js');
var dc = new Discord.Client();
dc.login(config.DC_TOKEN);

function applyCheck(method, str, arr) {
  if (typeof str[method] === "function") {
    for (let val of arr) { if (str[method](val)) return true; }
    return false;
  } else {
    throw new Error("Applied check must be a method of String.")
  }
}

var scp = {
  getRandList: function(type, status) {
    if ( type.toLowerCase()!="scp"&&type.toLowerCase()!="tale" ||
      status.toLowerCase()!="orig"&&status.toLowerCase()!="tran" ) return;
    var base = `http://scp-wiki-cn.wikidot.com/random:random-${type.toLowerCase()}`;
    if (status.toLowerCase()=="orig") { base+=`-cn`; var lb = 5, ub = 100; }
    else if (status.toLowerCase()=="tran") { var lb = 0, ub = 30; }
    got(base).then(res => {
      var $ = cheerio.load(res.body);
      var redSnip = 'http://snippets.wdfiles.com/local--code/code:iframe-redirect#';
      var rand = $('.list-pages-item').children('p').children('iframe').filter(function(i, el) {
        return $(this).attr('src').startsWith(redSnip);
      }).attr('src').slice(redSnip.length);
      if (!rand||rand==undefined||rand.startsWith('http://scp-wiki-cn.wikidot.com/old:')) return null;

      got(rand).then(res => {
        var $ = cheerio.load(res.body);
        if (!$('#page-title').length) return null;
        else {
          var rating = $('#prw54355').contents().first().text().trim();
          if (!rating||rating==undefined) { rating="0" };
          rating = parseInt(rating);
          if (rating>=lb&&rating<=ub) {
            if (scp[status][type].length<10) { scp[status][type].push(rand); }
            else { scp[status][type].shift(); scp[status][type].push(rand); }
            //console.log(scp[status][type])
          }
        }
      }).catch(e=>console.log(e))
    }).catch(e=>console.log(e))
  },
  getRecTxt: async function(page) {
    var msgtxt = null;
    var res = await got(page);
    var $ = cheerio.load(res.body);
    if (!$('#page-title').length) return null;
    else {
      var title = $('#page-title').contents().first().text().trim();
      var rating = $('#prw54355').contents().first().text().trim();
      if (title.includes('\n')) { title = title.split('\n').join().trim(); }
	    $('.scp-image-block, .footer-wikiwalk-nav, .earthworm').remove()
      var extract = "項目編號", pno;
        while (applyCheck("startsWith", extract, ["項目編號","项目编号","威脅等級","威脅級别","威胁级别","威胁等级","附錄","附录"]) ||
        applyCheck("includes", extract, ["紀錄開始","記錄開始","纪录开始","记录开始","紀錄結束","記錄結束","纪录结束","记录结束"]) ||
        !extract.trim()) {
          pno = Math.floor(Math.random()*($('#page-content p').length))
          extract = $($('#page-content p').get(pno)).text();
        }
      msgtxt = `推文：${title}\n${page}\n評分：${rating}\n\n${extract}`;
    }
    return msgtxt;
  },
  sendRec: async function() {
    try {
      var d = new Date();
      var day = Math.floor(d.getTime()/86400000);
      var hr = (d.getUTCHours()+8)%24;
      if (hr<1||hr>=9) {
        var msg;
        if (day%2) {
          if (hr%2&&scp.orig.scp.length) { msg = await scp.getRecTxt(scp.orig.scp.shift()); }
          else if (scp.orig.tale.length) { msg = await scp.getRecTxt(scp.orig.tale.shift()); }
        } else {
          if (hr%2&&scp.tran.scp.length) { msg = await scp.getRecTxt(scp.tran.scp.shift()); }
          else if (scp.tran.tale.length) { msg = await scp.getRecTxt(scp.tran.tale.shift()); }
        }
        for (gp of config.MSG_GP) { cq("send_group_msg", {group_id:gp, message:msg}).catch(e=>console.log(e)) }
        let chan = await dc.channels.fetch(config.DC_CHAN)
        chan.send(msg)
      }
    } catch (e) { console.log(e) }
  },
  orig: { scp:[], tale: [] },
  tran: { scp:[], tale: [] }
};


scp.getRandList("scp", "orig");
scp.getRandList("tale", "orig");
scp.getRandList("scp", "tran");
scp.getRandList("tale", "tran");

setTimeout(scp.sendRec,10000)

scp.id = {
  rec: setInterval(scp.sendRec, 3600000),
  origscp: setInterval(scp.getRandList, 300000, "scp", "orig"),
  origtale: setInterval(scp.getRandList, 300000, "tale", "orig"),
  transcp: setInterval(scp.getRandList, 300000, "scp", "tran"),
  trantale: setInterval(scp.getRandList, 300000, "tale", "tran")
}

cq.__scp = scp;

var pref = config.CMD_PREFIX.toLowerCase();

fs.readdir("./cmds/", (err, files) => {

    if(err) console.log(err);

    let jsfile = files.filter(f => f.split(".").pop()=="js"
      && !["disabled.js", "admin.js", "pm.js"].includes(f.split("-").pop()))
    let admjsfile = files.filter(f => f.split("-").pop()=="admin.js")
    let pmjsfile = files.filter(f => f.split("-").pop()=="pm.js")
    if(!(jsfile.length||admjsfile.length||pmjsfile.length)){
      console.log("No command files available.");
      return;
    }

    function loadcmd(cmds, map) {
      cq[map] = new Map();
      cmds.forEach((f, i) =>{
        let props = require(`./cmds/${f}`);
        console.log(`${f} loaded.`);
        cq[map].set(props.help.name, props);
      });
    }
    loadcmd(jsfile, "__cmd");
    loadcmd(admjsfile, "__admcmd");
    loadcmd(pmjsfile, "__pmcmd");
});

cq.on("message", msg => {
  /*if (msg.group_id!=undefined) {
    console.log(`gp: `+msg.group_id)
  } else if (msg.session_id!=undefined) {
    console.log(`sess: `+msg.session_id)
  }*/
  if (msg.message[0].type!="text"||!msg.message[0].data.text.toLowerCase().startsWith(pref)) return;
  if (config.MSG_GP.includes(msg.group_id.toString(10))) {
    let args = msg.message[0].data.text.toLowerCase().split(" ");
    let cmd = args.unshift().slice(pref.length);
    let cmdfile = cq.__cmd.get(cmd);
    if (cmdfile!==undefined) { return cmdfile.run(cq, msg, args); }
  } else if (msg.message_type === "private" && msg.user_id === "2502425837") {
    let args = msg.message[0].data.text.toLowerCase().split(" ");
    let cmd = args.unshift().slice(pref.length);
    let cmdfile = cq.__pmcmd.get(cmd);
    if (cmdfile!==undefined) { return cmdfile.run(cq, msg, args); }
  }
});

setInterval(cq, 86400000, 'clean_data_dir', {"data_dir":"image"})
