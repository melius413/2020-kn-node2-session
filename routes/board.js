const path = require('path');
const fs = require('fs');
const express = require('express');
const moment = require('moment'); // moment.js, date 처리에 좋은 모듈
const router = express.Router();
const { pager } = require(path.join(__dirname, '../modules/pager')); // pager 사용
const { upload } = require(path.join(__dirname, '../modules/multer'));
const { connect } = require(path.join(__dirname, '../modules/mysql'));
const { unLink, getLink, getURL, PLACE_HOLDER } = require(path.join(__dirname, '../modules/file-util'));
// unLink 파일지우기
// PLACE_HOLDER 첨부파일이 없을때

router.get(['/', '/list', '/list/:page'], async (req, res, next) => {
	let page = Number(req.params.page);
	if(!page) page = 1;
	req.app.locals.page = page;
	let sql = "SELECT count(id) FROM board";
	let result = await connect.execute(sql);
	let pagerVals = pager({ page, total: result[0][0]['count(id)'] });
	sql = "SELECT * FROM board ORDER BY id DESC LIMIT ?, ?"; // ?, ? 시작레코드, 가져올 갯수
	let sqlVals = [pagerVals.stRec, pagerVals.list];
	result = await connect.execute(sql, sqlVals);
	for(let v of result[0]) {
		v.wdate = moment(v.wdate).format('YYYY-MM-DD');
	}
	const pugVals = { rs: result[0], pager: pagerVals };
	res.render('board-list.pug', pugVals);
});

// 작성하기, 수정하기 공통사용
router.get(['/write', '/write/:id'], async (req, res, next) => {
	let title = req.params.id ? "글수정" : "글작성";
	let rs = {id: '', title: '', writer: '', savefile: '', content: ''};
	if(req.params.id) { // 수정하기
		let sql = "SELECT * FROM board WHERE id="+req.params.id;
		let result = await connect.execute(sql);
		rs = result[0][0];
	}
	let pugVals = { title, rs }
	res.render('board-write.pug', pugVals);
});

router.get('/view/:id', async (req, res, next) => {
	let sql = "SELECT * FROM board WHERE id="+req.params.id;
	let result = await connect.execute(sql);
	if(result[0][0].savefile) {
		result[0][0].downfile = result[0][0].savefile;
		result[0][0].savefile = getURL(result[0][0].savefile);
	}
	result[0][0].wdate = moment(result[0][0].wdate).format('YYYY-MM-DD HH:mm:ss');
	let pugVals = { title: "상세보기", rs: result[0][0] }
	res.render('board-view.pug', pugVals);
});

// 작성하기/수정하기에서 업로드를 공유하는 URL임
router.post('/save', upload.single('file'), async (req, res, next) => {
	let { id = '', title, writer, content, wdate = new Date(), realfile = '', savefile = '' } = req.body;
	let sql = '', sqlVals = [], result = {};
	if(req.file) { // 업로드 파일이 있다면
		realfile = req.file.originalname;
		savefile = req.file.filename; // uploads 폴더에 저장될 이름
	}
	if(id === '') { // 작성하기 시
		sql = "INSERT INTO board SET title=?, writer=?, content=?, wdate=?, realfile=?, savefile=?, writer_id=?";
		sqlVals = [title, writer, content, wdate, realfile, savefile, req.session.userid];
	}
	else { // 수정하기 시
		if(req.file) { // 첨부파일을 올렸다면
			sql = "SELECT savefile FROM board WHERE id="+id;
			result = await connect.execute(sql);
			if(result[0][0].savefile) unLink(result[0][0].savefile); // 기존파일이 있다면, 해당파일을 지우고
			sql = "UPDATE board SET title=?, writer=?, content=?, realfile=?, savefile=? WHERE id=? AND writer_id=?";
			sqlVals = [title, writer, content, realfile, savefile, id, req.session.userid];
		}
		else {
			sql = "UPDATE board SET title=?, writer=?, content=? WHERE id=? AND writer_id=?";
			sqlVals = [title, writer, content, id, req.session.userid];
		}
	}
	result = await connect.execute(sql, sqlVals);
	res.redirect("/board");
});

router.get('/delete/:id', async (req, res, next) => {
	let id = req.params.id;
	let sql, sqlVals, result;
	sql = "SELECT savefile FROM board WHERE id="+id;
	result = await connect.execute(sql);
	if(result[0][0].savefile) unLink(result[0][0].savefile);
	sql = "DELETE FROM board WHERE id=? AND writer_id=?";
	sqlVals = [id, req.session.userid];
	result = await connect.execute(sql, sqlVals);
	res.redirect("/board");
});


router.get('/remove', (req, res, next) => {
	let file = getLink(req.query.file);
	fs.unlink(file, async (err) => { // 파일삭제
		let json = {};
		if(err) res.json({code: 500});
		else {
			let sql = 'UPDATE board SET realfile="", savefile="" WHERE id=? AND writer_id=?'; // 파일삭제 정보 DB적용
			let sqlVals = [req.query.id, req.session.userid];
			let result = await connect.execute(sql, sqlVals);
			res.json({code: 200});
		}
	});
});

router.get("/download/:file", (req, res, next) => {
	const file = req.params.file;
	const filename = getLink(file); // 절대경로 가져오기
	res.download(filename); // respose 객체에 파일 다운로드 메소드가 있다. (절대경로필요)
})


module.exports = router;