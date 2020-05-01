const rp = require("request-promise");
const cheerio = require("cheerio");

var getrectxt = async function(page) {
  var msgtxt = `\n${page}\n`;
  var $ = await rp({ uri:page, transform: function (body) { return cheerio.load(body); }})
  if (!$('#page-title').length) return null;
  else {
    var title = $('#page-title').contents().first().text().trim();
    var rating = $('.prw54353').contents().first().text().trim();
    if (title.includes('\n')) { title = title.split('\n').join().trim(); }
    var pno = Math.floor(Math.random()*($('#page-content').children('p').length))
    var extract = $($('#page-content').children('p').get(pno)).text()
    console.log(extract)
    msgtxt = `推文：${title}${msgtxt}評分：${rating}\n\n${extract}`;
  }

  return msgtxt;
}
getrectxt(`http://scp-wiki-cn.wikidot.com/scp-cn-1210`)//.then((msgtxt)=>{console.log(msgtxt)})
