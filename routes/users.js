var path = require('path');
var express = require('express');
var crypto = require('crypto');
var router = express.Router();
var { connect } = require(path.join(__dirname, '../modules/mysql'));

/* GET users listing. */
router.get(['/', '/login'], (req, res, next) => {
  const values = {
    title: "로그인"
  };
  res.render('login.pug', values);
});

router.get("/join", (req, res, next) => {
  const values = {
    title: "회원가입"
  }
  res.render('join.pug', values);
});

router.get("/logout", (req, res, next) => {
  req.session.destroy((err) => {
	  req.app.locals.userid = '';
	  req.app.locals.username = '';
	  req.app.locals.grade = '';
    res.redirect("/");
  });
});

router.post("/save", async (req, res, next) => {
  let {userid, userpw, username, createAt = new Date(), grade = 1} = req.body;
  userpw = crypto.createHash('sha512').update(userpw + process.env.salt).digest('base64');
  let sql = 'INSERT INTO user SET userid=?, userpw=?, username=?, createAt=?, grade=?';
  let value = [userid, userpw, username, createAt, grade];
  try {
    let result = await connect.execute(sql, value);
    res.redirect("/user");
  }
  catch(err) {
    next(err);
  }
});

router.post("/loginModule", async (req, res, next) => {
  let {userid, userpw} = req.body;
  userpw = crypto.createHash('sha512').update(userpw + process.env.salt).digest('base64');
  let sql = 'SELECT userid, grade, username FROM user WHERE userid=? AND userpw=?';
  let value = [userid, userpw];
  let result = await connect.execute(sql, value);
  if(result[0][0]) {
    // req, res, next는 모든 매소드가 사용가능하므로, 세션정보를 req에 넣음
    // 해당 세션정보는 메모리에 저장되나, db설정을 하면 db에 저장됨.
    // 분산처리를 위해서 다른 PC에 공유를 위해서 필수
    req.session.userid = result[0][0].userid;
    req.session.username = result[0][0].username;
    req.session.grade = result[0][0].grade;
    // locals 퍼그가 쓰는 전역번수임. app 속성은????
    req.app.locals.userid = req.session.userid;
    req.app.locals.username = req.session.username;
    req.app.locals.grade = req.session.grade;
    res.redirect('/');
  }
  else {
    res.send(`
    <script>
    alert("아이디와 패스워드를 확인하세요.");
    location.href = '/';
    </script>`);
  }
});

module.exports = router;
