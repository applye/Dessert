const http = require('http');
const url = require('url');
const superagent = require('superagent');
const cheerio = require('cheerio');
const eventproxy = require('eventproxy');
const async = require('async');
let targetUrl = 'http://www.cnblogs.com/';
const ep = new eventproxy();

const topicUrls = [];      //存放爬取url
const pageUrls = [];    //存放收集文章页面网站
const pageNum = 10;    //爬取文章页数
const deletRepeat = {};  //去重哈希数组
const cachDate = [];  //存放爬取数据
const startDate = new Date();  //开始时间
let endDate = false;  //结束时间



for (var i = 1; i <= pageNum; i++) {
    pageUrls.push('http://www.cnblogs.com/?CategoryId=808&CategoryType=%22SiteHome%22&ItemListActionName=%22PostList%22&PageIndex=' + i + '&ParentCategoryId=0');
}
//抓取昵称、入园年龄、粉丝、关注数
function personInfo(url) {
    const infoArray = {};
    superagent.get(url)
        .end(function (err, ares) {
            if (err) {
                console.log(err);
                return;
            }
            let $ = cheerio.load(ares.text);
            let info = $('#profile_block a');
            let len = info.length;
            let age = "";
            let flag = false;
            let curDate = new Date();
            try {
                age = "20" + (info.eq(1).attr('title').split('20')[1]);
            } catch (error) {
                console.log(error);
                age = "2010-11-11";
            }
            infoArray.name = info.eq(0).text();
            infoArray.age = parseInt((new Date() - new Date(age)) / 1000 / 60 / 60 / 24);
            if (len === 4) {
                infoArray.fans = info.eq(2).text();
                infoArray.focus = info.eq(3).text();
            } else if (len === 5) {
                infoArray.fans = info.eq(3).text();
                infoArray.focus = info.eq(4).text();
            }
            console.log(`用户信息： ` + JSON.stringify(infoArray));
            catchDate.push(infoArray);
        });
}

//判断作者是否重复
function isRepeat(authorName) {
    if (deleteRepeat[authorName] == undefined) {
        deletRepeat[authorName] = 1;
        return 0;
    } else if (deleteRepeat[authorName] == 1) {
        return 1;
    }
}


function start() {
    function onRequest(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        //当所有BlogAricleHtml事件完成后的回调事件
        ep.after('BlogArticleHtml', pageUrls.length * 20, function (articleUrls) {
            for (let i = 0; i < articleUrls.length; i++) {
                res.write(articleUrls[i] + '<br/>');
            }
            console.log('articleUrls.length is' + articleUrls.length + ',content is: ' + articleUrls);


            //控制并发数
            let curCount = 0;
            let retileMove = function (url, callback) {
                let delay = parseInt((Math.random() * 30000000) % 1000, 10);
                curCount++;
                console.log('现在的并发数是', curCount, ',正在抓起的是', url, ',耗时' + delay + '毫秒');
                superagent.get(url)
                    .end(function (err, sres) {
                        if (err) {
                            console.log(err);
                            return;
                        }
                        let $ = cheerio.load(sres.text);
                        //收集信息
                        let currentBlogApp = url.split('/p/')[0].split('/')[3],
                            requestId = url.split('/p/')[1].split('.')[0];
                        res.write('currentBlogApp is ' + currentBlogApp + ' , ' + 'requestId id is ' + requestId + '<br/>');
                        console.log('currentBlogApp is ' + currentBlogApp + '\n' + 'requestId id is ' + requestId);

                        res.write('this aricle title is :' + $('title').text() + '<br/>');

                        let flag = isRepeat(currentBlogApp);
                        if (!flag) {
                            let appUrl = "http://www.cnblogs.com/mvc/blog/news.aspx?blogApp=" + currentBlogApp;
                            personInfo(appUrl);
                        }
                    });
                setTimeout(function () {
                    curCount--;
                    callback(null, url + 'Call back content');
                }, delay);
            };


            //async控制异步抓取
            async.mapLimit(articleUrls, 5, function (url, callback) {
                retileMove(url, callback);
            }, function (err, result) {
                endDate = new Date();
                console.log('final:');
                console.log(result);
                console.log(cachDate);

                let len = cachDate.length,
                    aveAge = 0,
                    aveFans = 0,
                    aveFocus = 0;

                for (let i = 0; i < len; i++) {
                    let eachDate = JSON.stringify(cachDate[i]),
                        eachDateJson = cachDate[i];

                    eachDateJsonFans = eachDateJson.fans || 110,
                        eachDateJsonFous = eachDateJson.focus || 11;

                    aveAge += parseInt(eachDateJson.age);
                    aveFans += parseInt(eachDateJsonFans);
                    aveFocus += parseInt(eachDateJsonFous);

                    res.write(eachDate + '<br/>');
                }

                //统计结果
                res.write('<br/>');
                res.write('<br/>');
                res.write('/**<br/>');
                res.write(' * 爬虫统计结果<br/>');
                res.write('**/<br/>');
                res.write('1、爬虫开始时间:' + startDate + '<br/>');
                res.write('2、爬虫结束时间:' + endDate + '<br/>');
                res.write('3、耗时：' + (endDate - startDate) + 'ms' + '----->' + (Math.round((endDate - startDate) / 1000 / 60 * 100) / 100) + 'min <br/>');
                res.write('4、爬虫遍历的文章目录: ' + pageNum * 20 + '<br/>');
                res.write('5、作者人数: ' + len + '<br/>');
                res.write('6、作者入园平均天数: ' + Math.round(aveAge / len * 100) / 100 + '<br/>');
                res.write('7、作者人均粉丝数：' + Math.round(aveFans / len * 100) / 100 + '<br/>');
                res.write('8、作者人均关注数：' + Math.round(aveFocus / len * 100) / 100 + '<br/>');
            });
        });

        pageUrls.forEach(function (pageUrl) {
            superagent.get(pageUrl)
                .end(function (err, res) {
                    let $ = cheerio.load(res.text);
                    const curPageUrls = $('.titlelnk');
                    for (let i = 0; i < curPageUrls.length; i++) {
                        let articleUrl = curPageUrls.eq(i).attr('href');
                        topicUrls.push(articleUrl);
                        ep.emit('BlogArticleHtml', articleUrl);
                    }
                });
        });
    }
    http.createServer(onRequest).listen(3000);
}
start();

