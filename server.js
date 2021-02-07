const express = require('express');
const unirest = require('unirest');
const cache = require('memory-cache');
const app = express();
const port = 3000;
const baseUrl = "https://hacker-news.firebaseio.com/v0";

let memCache = new cache.Cache();
let duration = 900000;   // milliseconds 

var callHacakerRankApi = function (url) {

    return unirest
    .get(url)
    .then(response => {
        if (!response && !response. body) {
            return Promise.reject("Not able to fetch data now");
        }
        return response.body;
    })
};

var sortByScore = (a, b) => b.score - a.score;

var mapStories = x => Object.assign({}, {
    title: x.title,
    URL: x.url,
    score: x.score,
    time: new Date(x.time * 1000),
    user: x.by
});

app.get('/best-stories', function (req, res) {

    let cacheContent = memCache.get("best-stories");
    if (cacheContent) {
        return res.send({
            success: true,
            data: cacheContent
        });
    }
    callHacakerRankApi(baseUrl + "/beststories.json")
    .then(data => data.slice(0, 10))
    .then(data => {
        let stories = [];
        data.forEach(x => stories.push(callHacakerRankApi(baseUrl + "/item/"+ x + ".json")));
        return stories;
    })
    .then(stories => Promise.all(stories))
    .then(results => results.sort(sortByScore))
    .then(results => results.map(mapStories))
    .then(data => {
        memCache.put("best-stories", data, duration);
        return res.send({
        success: true,
        data 
    })})
    .catch(err => {
        console.log(err);
        return res.send({
            success: false,
            message: "Not able to serve the request"
        });
    });
});

app.get('/past-stories', function (req, res) {

    let cacheContent = memCache.get("past-stories");
    if (cacheContent) {
        return res.send({
            success: true,
            data: cacheContent
        });
    }
    
    callHacakerRankApi(baseUrl + "/topstories.json")
    .then(data => {
        memCache.put("past-stories", data, duration);
        return res.send({
            success: true,
            data 
        });
    })
    .catch(err => {
        console.log(err);
        
        return res.send({
            success: false,
            message: "Not able to serve the request"
        });
    });
});

app.get('/comments', function (req, res) {
    
    if (!req.query.story) {
        return res.send({
            success: false,
            message: "Plese provide story in the request" 
        });
    }
    let cacheContent = memCache.get(req.query.story);
    if (cacheContent) {
        return res.send({
            success: true,
            data: cacheContent
        });
    }
    let story = req.query.story;
    let results = {};

    callHacakerRankApi(baseUrl + "/item/"+ story + ".json")
    .then(data => data.kids)
    .then(kids => {
        results.totolComments = kids.length;
        return kids.slice(0,10);
    })
    .then(data => {
        let comments = [];
        data.forEach(x => comments.push(callHacakerRankApi(baseUrl + "/item/"+ x + ".json")));
        return comments;
    })
    .then(comments => Promise.all(comments))
    .then(comments => {
        let users = [];
        comments.forEach(x => users.push(callHacakerRankApi(baseUrl + "/user/"+ x.by + ".json")));
        results.comments = comments.map(x => { return { text: x.text, user: x.by}});
        return users;
    })
    .then(users => Promise.all(users))
    .then(users => {
        users = users.map(x => {
            return {
                user: x.id,
                profileYears: new Date().getFullYear() - new Date(x.created * 1000).getFullYear()
            };
        });
        results.comments.map(x => {
            x.profileYears = users.find(y => y.user == x.user).profileYears;
            return x;
        });
        memCache.put(story, results, duration);
        return results;
    })
    .then(results => res.send({
            success: true,
            data: results
    }))
    .catch(err => {
        console.log(err);
        return res.send({
            success: false,
            message: "Not able to serve the request"
        });
    });
});

app.listen(port, () => {
    console.log("app runnig on port 3000")
});
