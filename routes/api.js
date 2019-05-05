/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
const request = require('request');


var MONGO_DB = process.env.DB;
var API_KEY = process.env.API;

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});
var meta = 'Meta Data';
var price = 'Time Series (5min)'


//***************************************
//
//    CONTROLLER FUNCTION: datagetter(stock,cb())
//
//***************************************

function dataGetter(stock,callback){
  var token = process.env.TOKEN
  var address = "https://cloud.iexapis.com/stable/stock/"+stock+"/quote?token="+token
  
  //request("https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol="+stock+"&interval=5min&outputsize=full&apikey="+API_KEY,function(err,res,body){
  request(address,function(err,res,body){
    if(!err && res.statusCode == 200){
      var result = JSON.parse(body);
      //console.log(result);
      var symbol =  result['symbol']
      console.log(symbol)
      // var time = result['Meta Data']['3. Last Refreshed']
      // console.log(time);
      var price = result['latestPrice'];
      console.log(price);
      callback('stockData',{stock:symbol,price:price})
  
      
    }
    else{
      console.log('issue');
      callback('stockData','external source error')
    }
  })
}

//dataGetter("CGC")
//***************************************
//
//    CONTROLLER FUNCTION: getLikes(stock,like,ip,cb())
//
//***************************************

function getLikes(stock,like,ip,callback){ 
  MongoClient.connect(MONGO_DB,function(err,db){
    if(!like){
      db.collection('StockLikes').find(
      {
        stock:stock
      }).toArray(function(err,data){
        var likes;
        if(data.length>0){
          likes = data[0].likes.length; 
        }
        else{
          likes = 0;
        }
        callback('likeData',{stock:stock,likes:likes})
      })
    }
    else{
      db.collection('StockLikes').findAndModify(
        {stock:stock},
        [],
        //add ip to likes for like = true
        {$addToSet: { likes: ip } },
        {new:true,upsert:true},
        function(err,data){
          callback('likeData',{stock:stock,likes:data.value.likes.length})
        }
  
     )
    }
    
  })
  
}




module.exports = function (app) {
//var API_URL="https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol="+stock+"&interval=5min&outputsize=full&apikey="+API_KEY;
//  console.log(JSON.parse(API_URL));
  app.route('/api/stock-prices')
  //get likes //if no likes exist
    .get(function (req, res){
    var stock
    //set vars and determing how many stocks are in req and datatypes
      if(typeof req.query.stock == 'string'){
         stock = req.query.stock.toUpperCase();
      }
    else{
      for(let i=0;i<req.query.stock.length;i++){
        req.query.stock[i].toUpperCase();
      }
      stock = req.query.stock};
      var like = req.query.like || false;
      var reqIP = req.connection.remoteAddress;
      var stockData = null;
      var likeData = null;
      var twoStocks = false;
      if(Array.isArray(stock)){
        console.log("----------------"+stock+"+-----------")
        twoStocks = true;
        stockData = [];
        likeData = [];
      }
      //function to gather stock data and establish like data and associate it with stock data via likes or rel_likes property.
      function syncDataCallback(dataType, data){  
        //set stockData and likeData based on multiple
        if(dataType == 'stockData'){
          if(twoStocks){
            stockData.push(data)
          } else{
            stockData = data;
          }
        } else{
          if(twoStocks){
            likeData.push(data)
          } else{
            likeData = data;
          }
        }
        //determine json response based on number of stocks and data length to determing rel_likes  
        //if 1 stock, and stock data and like data not null, allow stock data likes to equal like data and return json object of stock data
        if(!twoStocks && stockData && likeData !== null){
          stockData.likes = likeData.likes;
          console.log("if1 stockdata: "+JSON.stringify(stockData))
          res.json({stockData})
          //else if 2 stocks
        } else if (twoStocks && stockData.length == 2 && likeData.length == 2){
          //if first stock is most liked data, reference from first stock likes, else from second stock likes.
          // ie. aapl 2 likes, goog 4 likes, use second statement, aapl -2, goog 2
          if (stockData[0].stock == likeData[0].stock){
            stockData[0].rel_likes = likeData[0].likes - likeData[1].likes;
            stockData[1].rel_likes = likeData[1].likes - likeData[0].likes;
          } else {
            stockData[0].rel_likes = likeData[1].likes - likeData[0].likes;
            stockData[1].rel_likes = likeData[0].likes - likeData[1].likes; 
          }
          console.log("if2 stockdata: "+JSON.stringify(stockData))
          res.json({stockData});
        }
      }
    
    
    //run controller apps for 2 stocks or 1 stock
      if(twoStocks){
        dataGetter(stock[0],syncDataCallback);
        getLikes(stock[0],like,reqIP,syncDataCallback);
        dataGetter(stock[1],syncDataCallback);
        getLikes(stock[1],like,reqIP,syncDataCallback);
      } else{
        dataGetter(stock,syncDataCallback);
        getLikes(stock,like,reqIP,syncDataCallback);
      }
    
    })
  
 

    
};

 