const superagent = require("superagent");
const cheerio = require("cheerio");
const eventproxy = require("eventproxy");
const async = require("async");
const http = require("http");
const https = require('https');
const path = require("path");
const ap = new eventproxy();
const fs = require("fs");
const pageNum = 1;    //爬取页数
const pageUrl = [];
const pages = [];
const startTime = new Date();
let endTime = "";
const prictureUrl = [];

const pictures = [];

http.createServer(onRequest).listen(3000);


for (let i = 1; i <= pageNum; i++) {
    pages.push("https://www.aitaotu.com/weimei/list_" + i + ".html");
}

let pricture = {};  //存图片对象

function onRequest(req, respone) {
    respone.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    pages.forEach(function (url) { 
           superagent.get(url)
            .set("User-Agent","Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36")
            .buffer(true)
            .end(function (err, res) {
            if (err) {
                console.log(err);
                return;
            }
            let $ = cheerio.load(res.text);
            const items = $(".masonry_brick");
            for (let i = 0; i < items.length; i++) {
                let url = items.eq(i).find("a").attr('href');
                let key = url.substring(url.lastIndexOf("/")+1, url.lastIndexOf("."));
                url = "https://www.aitaotu.com" + url;
                let title =  items.eq(i).find(".item_b a").text();
                let tag =  items.eq(i).find(".items_comment a").text();
                let time = items.eq(i).find(".items_likes").text();
                pricture[key] = {};
                pricture[key] = {title: title, tag: tag, time: time }
                pageUrl.push(url);
                ap.emit("end", url);
            }
        });
    });

    ap.after("end", pages.length * 18, function (details) {
        for (let i = 0; i < details.length; i++) {
            respone.write(details[i] + "<br/>");
        }
        console.log("details is count " + details.length);

        async.mapLimit(details, 5, function (url, callback) {
            retileMove(url, callback);
        }, function (err, result) {
            let cont = 0;
            let key = ""; //保存key
            //取当前页的图片数
            async.mapLimit(prictureUrl, 2, function(pageurl, callback) {
                let delay = parseInt((Math.random() * 10000000) % 1000, 10);
                cont++;
                console.log('现在的图片url并发数是', cont, ',正在抓起的是', pageurl, ',耗时' + delay + '毫秒');
                superagent.get(pageurl).end(function(err, res) {
                    if(err) {
                        console.log(err);
                        return;
                    }
                    let $ = cheerio.load(res.text);
                    //获取每页图片数，并把图片地址都存起来
                    key = pageurl.substring(pageurl.lastIndexOf("/")+1,pageurl.lastIndexOf("_"));
                    let pritureNum = $("#big-pic p a").length;
                    let desc = $(".tsmaincont-main-cont-desc h3").text().replace($(".tsmaincont-main-cont-desc h3 strong").text(), "");
        
                    if(desc) {
                        pricture[key].desc = desc;
                    }
                    if(!pricture[key].iamgs) {
                        pricture[key].iamgs = [];
                    }
                    //获取url
                    for(let i=0;i<pritureNum;i++) {
                        let url = $("#big-pic p a").eq(i).find("img").attr("src");
                        //收集需要信息放入对象中
                        pricture[key].iamgs.push(url);
                        pictures.push(url);
                    }
                });
                
                setTimeout(function() {
                    cont--;
                    callback(null);
                }, delay);

            }, function (error, res) {
            
                //下载文件
                let x = 0;
                let cont = 0;
              
                //控制下载图片的并发
                async.mapLimit(pictures, 2, function(priUrl, callback) {
                    let delay = parseInt((Math.random() * 10000000) % 1000, 10);
                    cont++;
                    console.log('图片download并发数是', cont, ',正在抓起的是', priUrl, ',耗时' + delay + '毫秒');
                    https.get(priUrl, function(res) {
                        res.setEncoding('binary'); //转二进制
                        let cont ="";
                        res.on('data', function(data) {
                            cont +=data;
                        });
                        res.on("end", function() {
                            fs.writeFile("./images/" + x++ +".jpg", cont, 'binary', function(err) {
                               
                            });
                        });
                        res.on("error", function(err) {
                            console.log(err);
                        });
                    }).on('error', function(err) {
                        console.log(err);
                    });

                    setTimeout(function() {
                        cont--;
                        callback(null);
                    }, delay);
                }, function(err, res) {
                    endTime = new Date();;
                    console.log(pricture);
                    respone.write('1、耗时：' + (endTime - startTime) + 'ms' + '----->' + (Math.round((endTime - startTime) / 1000 / 60 * 100) / 100) + 'min <br/>');
                    console.log("保存完成");
                });

            

            });
        
        });
    });

    //控制并发数
    let curCount = 0;
    const retileMove = function(url, callback) {
        let delay = parseInt((Math.random() * 10000000) % 1000, 10);
        curCount++;
        console.log('现在pagUrl的并发数是', curCount, ',正在抓起的是', url, ',耗时' + delay + '毫秒');
        superagent.get(url).end(function(err, res) {
            if(err) {
                console.log(err);
                return;
            }
            let $ = cheerio.load(res.text);
            //获取页数
            let num = $(".totalpage").text();
            //分别获取每页图片
            //获取url地址
            let eachPage = url.substring(url.lastIndexOf("/") +1, url.lastIndexOf(".")) +"_";
            let reqUrl = url.substring(0, url.lastIndexOf("/") +1);
            for(let j=1;j<=num;j++) {
                let addr = reqUrl + eachPage + j + ".html";
                //存每一页
                prictureUrl.push(addr);
            }
        });

        setTimeout(function() {
            curCount--;
            callback(null, url + 'Call back content');
        }, delay);

    }


}