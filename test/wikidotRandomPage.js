const request = require("request");
const cheerio = require("cheerio");

var scp = []

var getRandList = function (type, status) {
  if ( ("scp"!=type.toLowerCase()&&"tale"!=type.toLowerCase()) ||
    ("orig"!=status.toLowerCase()&&"tran"!=status.toLowerCase()) ) return console.log(`invalid args`);

  var base = `http://scp-wiki-cn.wikidot.com/random:random-${type.toLowerCase()}`;
  console.log(base)
  if (status.toLowerCase()=="orig") { base+=`-cn`; var lb = 5, ub = 100; }
  else if (status.toLowerCase()=="tran") { var lb = 0, ub = 30; }
  request(base, (e,res,body) => {
    if (e) { console.log(e); return null; }
    var $ = cheerio.load(body);
    var redSnip = 'http://snippets.wdfiles.com/local--code/code:iframe-redirect#';
    var rand = $('.list-pages-item').children('p').children('iframe').filter(function(i, el) {
      return $(this).attr('src').startsWith(redSnip);
    }).attr('src').slice(redSnip.length);
    console.log(rand)
    if (!rand||rand==undefined) return null;

    request(rand, (e,res,body) => {
      if (e) { console.log(e); return null; }
      var $ = cheerio.load(body);
      if (!$('#page-title').length) return null;
      else {
        var rating = $('.prw54353').contents().first().text().trim();
        if (!rating||rating==undefined) { rating="0" };
        rating = parseInt(rating);
        if (rating>=lb&&rating<=ub) {
          if (scp.length<10) { scp.push(rand); }
          else { scp.shift().push(rand); }
          console.log(rand)
          console.log(scp)
        }
      }
    })
  })
}

getRandList("scp", "orig");
