const got = require("got");
const cheerio = require("cheerio");
const winston = require('winston');

function applyCheck(method, str, arr) {
  if (typeof str[method] === "function") {
    for (let val of arr) { if (str[method](val)) return true; }
    return false;
  } else {
    throw new Error("Applied check must be a method of String.")
  }
}

let scp = {
  getRandList: function(type, status) {
    if ( type.toLowerCase()!="scp"&&type.toLowerCase()!="tale" ||
      status.toLowerCase()!="orig"&&status.toLowerCase()!="tran" ) return;
    let base = `http://scp-wiki-cn.wikidot.com/random:random-${type.toLowerCase()}`;
    if (status.toLowerCase()=="orig") { base+=`-cn`; var lb = 5, ub = 100; }
    else if (status.toLowerCase()=="tran") { var lb = 0, ub = 30; }
    got(base).then(res => {
      let $ = cheerio.load(res.body);
      let redSnip = 'http://snippets.wdfiles.com/local--code/code:iframe-redirect#';
      let rand = $('.list-pages-item').children('p').children('iframe').filter(function(i, el) {
        return $(this).attr('src').startsWith(redSnip);
      }).attr('src').slice(redSnip.length);
      if (!rand||rand==undefined||rand.startsWith('http://scp-wiki-cn.wikidot.com/old:')) return null;

      got(rand).then(res => {
        let $ = cheerio.load(res.body);
        if (!$('#page-title').length) return null;
        else {
          let rating = $('#prw54355').contents().first().text().trim();
          if (!rating||rating==undefined) { rating="0" };
          rating = parseInt(rating);
          if (rating>=lb&&rating<=ub) {
            if (scp[status][type].length<10) { scp[status][type].push(rand); }
            else { scp[status][type].shift(); scp[status][type].push(rand); }
            //console.log(scp[status][type])
          }
        }
      }).catch(e=>winston.error(e.stack))
    }).catch(e=>winston.error(e.stack))
  },
  getRecTxt: async function(page) {
    let msgtxt = null;
    let res = await got(page);
    let $ = cheerio.load(res.body);
    if (!$('#page-title').length) return null;
    else {
      let title = $('#page-title').contents().first().text().trim();
      let rating = $('#prw54355').contents().first().text().trim();
      if (title.includes('\n')) { title = title.replace('\n', '').trim(); }
	    $('.scp-image-block, .footer-wikiwalk-nav, .earthworm, #u-credit-view, .info-container').remove()
      let extract = "項目編號", pno;
        while (applyCheck("startsWith", extract, ["項目編號","项目编号","威脅等級","威脅級别","威胁级别","威胁等级","附錄","附录", "«"]) ||
        applyCheck("includes", extract, ["紀錄開始","記錄開始","纪录开始","记录开始","紀錄結束","記錄結束","纪录结束","记录结束"]) ||
        !extract.trim()) {
          pno = Math.floor(Math.random()*($('#page-content p').length))
          extract = $($('#page-content p').get(pno)).text();
        }
      msgtxt = `======\n推文：${title}\n${page}\n評分：${rating}\n\n${extract}\n======`;
    }
    return msgtxt;
  },
  sendRec: async function(config, qq) {
    try {
      let d = new Date();
      let day = Math.floor(d.getTime()/86400000);
      let hr = (d.getUTCHours()+8)%24;
      if (hr<1||hr>=9) {
        let msg;
        if (day%2) {
          if (hr%2&&scp.orig.scp.length) { msg = await scp.getRecTxt(scp.orig.scp.shift()); }
          else if (scp.orig.tale.length) { msg = await scp.getRecTxt(scp.orig.tale.shift()); }
        } else {
          if (hr%2&&scp.tran.scp.length) { msg = await scp.getRecTxt(scp.tran.scp.shift()); }
          else if (scp.tran.tale.length) { msg = await scp.getRecTxt(scp.tran.tale.shift()); }
        }
        for (gp of config.serveGroup) { qq.sendGroupMsg(gp, msg).catch(e=>winston.error(e.stack)) }
      }
    } catch (e) { winston.error(e.stack) }
  },
  orig: { scp:[], tale: [] },
  tran: { scp:[], tale: [] },
  start: (config, qq)=>{
    if (typeof config.serveGroup=="string") {
      config.serveGroup = JSON.parse(config.serveGroup);
    }

    if (config.serveGroup && config.serveGroup.length) {
      scp.getRandList("scp", "orig");
      scp.getRandList("tale", "orig");
      scp.getRandList("scp", "tran");
      scp.getRandList("tale", "tran");

      setTimeout(scp.sendRec,10000, config, qq);

      scp.id = {
        rec: setInterval(scp.sendRec, 3600000, config, qq),
        origscp: setInterval(scp.getRandList, 300000, "scp", "orig"),
        origtale: setInterval(scp.getRandList, 300000, "tale", "orig"),
        transcp: setInterval(scp.getRandList, 300000, "scp", "tran"),
        trantale: setInterval(scp.getRandList, 300000, "tale", "tran"),
      };
    }
  }
};


module.exports = scp;
