const rp = require('request-promise-native')
const fs = require('fs')
const process = require('process');

const username = process.argv.slice(2)[0]
const sessionId = process.argv.slice(3)[0]

let urlForUser = `https://www.instagram.com/web/search/topsearch/?context=user&count=0&query=${username}`;
let id
let variables
let $followers = []
let $following = []
let nextCursor
let nextPage

(async () => {
    let body = await rp.get(urlForUser)
    body = JSON.parse(body)
    console.log('ID of user: ' + String(body.users[0].user.pk))
    id = body.users[0].user.pk.toString()
    variables = JSON.stringify({"id": id, "include_reel": true, "fetch_mutual": true, "first": 45})
    await Promise.all([getFollowings(), getFollowers()]);
    logUnfollowers()
})();

// Get data from files and console.log the results
function logUnfollowers() {
    fs.readFile('myFollowers.txt', 'utf8', (err, data) => {
        if (err) throw err;
        let myFollowers = JSON.parse(data)
        fs.readFile('myFollowings.txt', 'utf8', (err, data) => {
            if (err) throw err;
            let myFollowings = JSON.parse(data)
            let unfollowers = myFollowings.filter(value => !myFollowers.includes(value))
            console.dir(unfollowers, {'maxArrayLength': null})
            console.log('The number of unfollowers:' + unfollowers.length);
            fs.writeFile('unfollowers.txt', JSON.stringify(unfollowers), 'utf-8', (err) => {
                if (err) throw(err)
                console.log('Succesfuly saved unfollowers.txt')
            })
        })
    })
}

// Recursively call this function until it gets all followers/followings.

// nextCur - telling api how far it came(how many followers/followings already collected)
// nextPag - is there next page or no
// hash - hash of query
// followers - boolean which tells are we trying to get followers or followings
async function processData(nextCur, nextPag, hash, followers) {
    if (nextPag) {
        let variablesLocal = JSON.stringify({
            "id": id,
            "include_reel": true,
            "fetch_mutual": true,
            "first": 100,
            "after": nextCur
        })

       let body = await rp.get({
            url: 'https://www.instagram.com/graphql/query/',
            headers: {
                'cookie': `sessionid=${sessionId};`
            },
            qs: {
                query_hash: hash,
                variables: variablesLocal
            },
        })
            body = JSON.parse(body)
            let data = followers ? body.data.user.edge_followed_by.edges : body.data.user.edge_follow.edges
            data.forEach(item => {
                followers ? $followers.push(item.node.username) : $following.push(item.node.username)
            })
            nextCursor = followers ? body.data.user.edge_followed_by.page_info.end_cursor : body.data.user.edge_follow.page_info.end_cursor
            nextPage = followers ? body.data.user.edge_followed_by.page_info.has_next_page : body.data.user.edge_follow.page_info.end_cursor
            await processData(nextCursor, nextPage, hash, followers)
    } else {
        let nameOfFile = followers ? 'myFollowers.txt' : 'myFollowings.txt'
        let file = followers ? JSON.stringify($followers) : JSON.stringify($following);
        (() => {
            return new Promise((res, rej) => {
                fs.writeFile(nameOfFile, file, 'utf-8', (err) => {
                    if (err) rej(err)
                    console.log('Succesfuly saved ' + nameOfFile)
                    res()
                })
            })
        })();
    }
}

// Get users who you are following
async function getFollowings() {
    console.log('Getting users which are followed by you')
    let hash = 'd04b0a864b4b54837c0d870b0e77e076'
    let body = await rp.get({
        url: 'https://www.instagram.com/graphql/query/',
        headers: {
            'cookie': `sessionid=${sessionId};`
        },
        qs: {
            query_hash: hash,
            variables: variables
        },
    })
    body = JSON.parse(body)
    let data = body.data.user.edge_follow.edges
    data.forEach(item => $following.push(item.node.username))
    nextCursor = body.data.user.edge_follow.page_info.end_cursor
    nextPage = body.data.user.edge_follow.page_info.has_next_page
    await processData(nextCursor, nextPage, hash, false)
}

// Get followers
async function getFollowers() {
    console.log('Getting users which are following you')
    let hash = 'c76146de99bb02f6415203be841dd25a'
    let body = await rp.get({
        url: 'https://www.instagram.com/graphql/query/',
        headers: {
            'cookie': `sessionid=${sessionId};`
        },
        qs: {
            query_hash: hash,
            variables: variables
        },
    })
    body = JSON.parse(body)
    let data = body.data.user.edge_followed_by.edges
    data.forEach(item => $followers.push(item.node.username))
    nextCursor = body.data.user.edge_followed_by.page_info.end_cursor
    nextPage = body.data.user.edge_followed_by.page_info.has_next_page
    await processData(nextCursor, nextPage, hash, true)
}