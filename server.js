const express = require('express');
const app = express();

//req 값 얻을 수 있음 
app.use(express.urlencoded({ extended: true }))
app.set('view engine', 'ejs');

//form 에서 put 요청 보낼 수 있음 
const methodOverride = require('method-override');
app.use(methodOverride('_method'));

//env 
require('dotenv').config();

var db;
const MongoClient = require('mongodb').MongoClient;
MongoClient.connect(process.env.DB_URL, function (err, client) {
    if (err) return console.log(err)
    db = client.db('todo');
    app.listen(process.env.PORT, function () {
        console.log('listening on 8080')
    })
})

//로그인
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

//app.use(미들웨어) - 요청과 응답사이에 동작 
app.use(session({ secret: 'reezee101', resave: true, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());


app.get('/login', function (req, res) {
    res.render('login.ejs');
});

//로컬방식으로 로그인 인증검사 (밑에 구현해놓기)
app.post('/login', passport.authenticate('local', {
    failureRedirect: '/fail'
}), function (req, res) { //응답 성공 
    res.redirect('/');
});

//LocalStrategy 인증 방식 구현 
passport.use(new LocalStrategy({
    usernameField: 'id',    //form name값 
    passwordField: 'pw',
    session: true,          //로그인 후 세션정보 저장
    passReqToCallback: false,
},

    //사용자 id, pw 검증
    function (id, pw, done) {
        db.collection('login').findOne({ id: id }, function (err, result) {

            //return done(1, 2, 3) 
            //1 : 서버에러 (db연결불가. . .)
            //2 : 성공시 사용자 db 데이터 (실패시 faise)
            //3 : 에러메세지

            if (err) return done(err);

            if (!result) return done(null, false, { message: '존재하지않는 아이디' });
            //암호화작업을 거쳐야 함 
            if (pw == result.pw) {
                //로그인 성공시 세션정보를 만들고 등록해야 함 (밑에서)
                return done(null, result);
            } else {
                return done(null, false, { message: '비번틀림' });
            }
        })
    })
);

//로그인 성공시 실행 
//유저의 세션데이터 생성
//생성된 세션데이터의 아이디를 쿠키로 만들어서 브라우저로 전송 
passport.serializeUser(function (result, done) {    //function(result, done) = 로그인 성공시 return done(null, result)
    done(null, result.id);
});

//로그인 된 유저가(세션 생성된 유저) 다른 경로 접속시 실행 (어떤 유저인지 해석)
//로그인 한 유저의 개인정보를 db에서 찾을 때
passport.deserializeUser(function (id, done) {            // done(null, result.id); = function(id, done)
    //result.id로 db에서 찾은 user정보들을 가져옴  
    db.collection('login').findOne({ id: id }, function (err, result) {
        console.log(result)
        done(null, result); //이 result 는 req.user에 담겨있어서 loginOrNot에서 가져다 쓸 수 있음 
    })
});

app.get('/fail', function (req, res) {
    res.render('login.ejs');
});


//로그인 한 사람만 접속 가능하게 
app.get('/mypage', loginOrNot, function (req, res) {
    res.render('mypage.ejs', { user: req.user });
});

function loginOrNot(req, res, next) {
    if (req.user) {   //로그인 후 세션이 있을 경우 req.user는 존재 
        next();
    } else {
        res.send('not login');
    }
};

//회원가입
app.get('/regist', (req, res) => {
    res.render('regist.ejs');
})
app.post('/regist', (req, res) => {
    db.collection('login').insertOne({ id: req.body.id, pw: req.body.pw }, function (err, result) {
        if (err) console.log(err)

        console.log('회가성공')
        res.redirect('/');
    })
})

//검색
//검색 인덱싱(몽고디비는 id순으로 자동정렬하므로 바이너리서치 알고리즘 사용하면 검색 빠름)
//제목으로는 정렬 안되어있으므로 제목정렬 된 컬렉션을 하나 더 만듦(인덱싱)
app.get('/search', function (req, res) {
    //console.log(req.query.value); 쿼리스트링 

    //full scan
    //db.collection('post').find({title : req.query.value}).toArray((err, result)=>{
    //db.collection('post').find({ $text : {$search:req.query.value} }).toArray((err, result)=>{    //한국어단어는 띄어쓰기단위로 검색하므로 부분검색 안먹는 단점이 있음

    console.log(req.query.value)
    //검색조건
    let search = [
        {
            $search: {
                index: 'titleSearch',
                text: {
                    query: req.query.value,
                    path: 'title'  // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
                }
            }
        }
    ];
    db.collection('post').aggregate(search).toArray((err, result) => {
        console.log(result)
        res.render('list.ejs', { posts: result });
    })
})


//글작성
app.get('/write', function (req, res) {
    res.render('write.ejs');
});

app.post('/add', function (req, res) {
    //if(!req.user.id) return;
    //form에서 전송된 정보를 req로 받으려면 body-parser 필요함 

    //게시글 id값 부여해주려면 counter컬렉션 name : 게시물갯수인 totalPost값 가져와서 1씩 증가시키면 됨 
    db.collection('counter').findOne({ name: '게시물갯수' }, function (err, result) {
        if (err) return console.log(err);
        let totalPost = result.totalPost;
        let insert = { _id: totalPost + 1, title: req.body.title, date: req.body.date, writerId: req.user._id, writer: req.user.id };
        db.collection('post').insertOne(insert, function (err, result) {
            if (err) return console.log(err)
            //counter컬렉션 name : 게시물갯수인 totalPost값을 1 증가시키기 
            db.collection('counter').updateOne({ name: '게시물갯수' }, { $inc: { totalPost: 1 } }, function (err, result) {   //$set : 변경, $inc : 증가, $min : 기존값보다 적을때만 변경, $rename : key값 변경 
                if (err) return console.log(err)
            })
            console.log('저장 완료');
        });
    });
    res.redirect('/list');
});

app.get('/', function (req, res) {
    res.render('index.ejs');
});

app.get('/list', function (req, res) {
    db.collection('post').find().toArray(function (err, result) {
        if (err) return console.log(err);
        console.log(result)
        res.render('list.ejs', { posts: result });
    });
});
app.get('/detail/:id', function (req, res) {
    db.collection('post').findOne({ _id: parseInt(req.params.id) }, function (err, result) {
        if (err) return console.log(err);
        res.render('detail.ejs', { post: result });
    });
});


//글수정
app.get('/edit/:id', function (req, res) {
    db.collection('post').findOne({ _id: parseInt(req.params.id) }, function (err, result) {
        if (err) return console.log(err);
        console.log(result)
        res.render('edit.ejs', { post: result });
    });
});

app.put('/edit', function (req, res) {
    db.collection('post').updateOne({ _id: parseInt(req.body.id) }, { $set: { title: req.body.title, date: req.body.date } }, function (err, result) {
        if (err) return console.log(err);
        console.log('수정완')
        console.log(result)
        res.redirect('/list');
        //res.render('detail.ejs', { post: result });
    });
});

//글삭제
app.delete('/delete', function (req, res) {
    req.body._id = parseInt(req.body._id);
    let deleteData = { _id: req.body._id, writerId: req.user._id };
    db.collection('post').deleteOne(deleteData, function (err, result) {
        if (err) return res.status(400);
        console.log(result)
        res.send('삭제 완료')
        res.status(200);    //요청 성공 
    })
})

let multer = require('multer');
//이미지 하드에 저장하는거 정의 
var storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, './public/image')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }

});

var upload = multer({ storage: storage });

//이미지 업로드
app.get('/upload', function (req, res) {
    res.render('upload.ejs');
})
//profile이라는 name 속성을 가진 input 데이터를 불러옴 
//app.post('/upload', upload.array('profile', 10), function (req, res) { //다건 파일 'profile', 10 : profile 최대 10개까지 
app.post('/upload', upload.single('profile'), function(req, res){ //단건 파일
    res.send('응답')

})

app.get('/image/:imgNm', function(req, res){
    res.sendFile(__dirname + '/public/image/' + req.params.imgNm )
})






// '/shop'경로로 접속하면 ./routes/shop.js 파일 실행 
app.use('/shop', require('./routes/shop.js'));

//로그인 한 사람만 접속가능 
app.use('/board/sub', loginOrNot, require('./routes/board.js'));


