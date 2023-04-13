const express = require('express');
const app = express();

//req 값 얻을 수 있음 
app.use(express.urlencoded({ extended: true }))
app.set('view engine', 'ejs');

//form 에서 put 요청 보낼 수 있음 
const methodOverride = require('method-override');
app.use(methodOverride('_method'));

var db;
//mongodb 연결
var password = 'wldnjs0604';
const MongoClient = require('mongodb').MongoClient;
MongoClient.connect('mongodb+srv://userTest:' + password + '@cluster0.g3zae.mongodb.net/?retryWrites=true&w=majority', function (err, client) {
    
    if (err) {
        return console.log('err : ' + err);
    }

    db = client.db('todo');
    //포트, 실행할 로직
    app.listen(8080, function () {
        console.log('8080')
    });

});

app.get('/', function (req, res) {
    res.render('index.ejs');
});

app.get('/write', function (req, res) {
    res.render('write.ejs');
});

app.post('/add', function (req, res) {
    //form에서 전송된 정보를 req로 받으려면 body-parser 필요함 

    //게시글 id값 부여해주려면 counter컬렉션 name : 게시물갯수인 totalPost값 가져와서 1씩 증가시키면 됨 
    db.collection('counter').findOne({ name: '게시물갯수' }, function (err, result) {
        if (err) return console.log(err);
        let totalPost = result.totalPost;

        db.collection('post').insertOne({ _id: totalPost + 1, title: req.body.title, date: req.body.date }, function (err, result) {
            if (err) return console.log(err)
            //counter컬렉션 name : 게시물갯수인 totalPost값을 1 증가시키기 
            db.collection('counter').updateOne({ name: '게시물갯수' }, { $inc: { totalPost: 1 } }, function (err, result) {   //$set : 변경, $inc : 증가, $min : 기존값보다 적을때만 변경, $rename : key값 변경 
                if (err) return console.log(err)
            })
            console.log('저장 완료');
        });
    });
    res.send('전송 완');
});

app.get('/list', function (req, res) {
    db.collection('post').find().toArray(function (err, result) {
        if (err) return console.log(err);
        res.render('list.ejs', { posts: result });
    });
});
app.get('/detail/:id', function (req, res) {
    db.collection('post').findOne({ _id: parseInt(req.params.id) }, function (err, result) {
        if (err) return console.log(err);
        res.render('detail.ejs', { post: result });
    });
});

app.get('/edit/:id', function (req, res) {
    db.collection('post').findOne({ _id: parseInt(req.params.id) }, function (err, result) {
        if (err) return console.log(err);
        console.log(result)
        res.render('edit.ejs', { post: result });
    });
});

app.put('/edit', function (req, res) {
    db.collection('post').updateOne({ _id: parseInt(req.body.id) }, { $set : { title : req.body.title , date : req.body.date}}, function (err, result) {
        if (err) return console.log(err);
        console.log('수정완')
        console.log(result)
        res.redirect('/list');
        //res.render('detail.ejs', { post: result });
    });
});
app.delete('/delete', function (req, res) {
    req.body._id = parseInt(req.body._id);
    console.log(req.body);
    db.collection('post').deleteOne(req.body, function (err, result) {
        if (err) return res.status(400);
        res.send('삭제 완료')
        res.status(200);    //요청 성공 
    })
})