import express from "express";
import bodyparser from "body-parser"
import mysql from "mysql"
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
const app = express();
app.set('view engine', 'ejs');
const port = 3000;
var initliaze=true;
var username;
app.use(cors());
app.use(session({
    secret: 'my-secret-key', // Session verilerini güvenli bir şekilde şifrelemek için kullanılan gizli anahtar
    resave: false,
    saveUninitialized: true
  }));
app.use(express.static("public"));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended:true}))
app.use(cookieParser());
function checkAuth(req, res, next) {
    if (req.session && req.session.username) {
        // Oturum varsa ve kullanıcı adı tanımlıysa devam et
        return next();
    } else {
        // Oturum yoksa veya kullanıcı adı tanımlı değilse giriş sayfasına yönlendir
        return res.redirect("/login");
    }
}
const db= mysql.createConnection({
    host:'localhost',
    user:'root',
    password:'',
    database:'ordiem',
    port:3306
})
db.connect((err)=>{
    if(err){
        console.error('Veritabanı bağlantı hatası:', err.message);
    }
    console.log('Veri tabani ile bağlanti başarili');
})
app.get("/", (req, res) => {
    username=req.session.username;
    if(username===undefined){
    initliaze=true
    }
    else{
        initliaze=false
    }
    res.render("index.ejs",{initliaze:initliaze,username:username});
});

app.get("/profile", (req, res) => {
    const username = req.session.username;

    if (!username) {
        // Redirect to login if the user is not logged in
        return res.redirect("/login");
    }

    // Fetch user details from the database based on the session username
    const sql = 'SELECT * FROM users WHERE username = ?';

    db.query(sql, [username], (err, results) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).send('An error occurred.');
        }

        if (results.length > 0) {
            // User details found in the database
            const user = results[0];

            // Render the profile page and pass user details to the view
            res.render("profile.ejs", { initliaze: false, username: user.username, email: user.email, password: user.password, level: user.level });
        } else {
            // No user found with the given username
            return res.status(404).send('User not found.');
        }
    });
});

app.get("/main",(req,res)=>{
    const username=req.session.username;
    res.render("main.ejs",{username:username, initliaze:initliaze})
})

app.get("/about",(req,res)=>{
    const username=req.session.username;
    res.render("about.ejs",{initliaze:initliaze, username:username})
    console.log(initliaze);
})

app.get("/signup",(req,res)=>{
    res.render("signup.ejs",{initliaze:initliaze});
})
app.post("/signup",(req,res)=>{
    initliaze = false;
    const {username, email, password, name, surname}=req.body;
    req.session.username=req.body.username;
    const sql = 'INSERT INTO users (username, email, password, name, surname) VALUES (?, ?, ?, ?, ?)'
    
    db.query(sql, [username, email, password, name, surname ], (err,result)=>{
        if(err){
            console.error('Kişi kaydedilemedi:', err.message);
        }
        console.log('Kullanıcı başarıyla kaydedildi.');
    }) 
    res.render("main.ejs",{username:username, initliaze:initliaze});
})

app.get("/login", (req, res) => {
    const errorMessage = req.query.error === '1' ? 'Geçersiz kullanıcı adı veya şifre.' : '';

    const rememberMe = req.cookies ? req.cookies.rememberMe || false : false;
    const savedUsername = req.cookies ? req.cookies.savedUsername || '' : '';
    const savedPassword = req.cookies ? req.cookies.savedPassword || '' : '';

    res.render("login.ejs", { errorMessage, rememberMe, savedUsername, savedPassword });
});


app.post("/login",(req,res)=>{
    initliaze=false;
    const {username, password, rememberMe} = req.body;
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(sql, [username, password], (err,results)=>{
        if(err){
            console.error('Veritabanı hatası:', err.message);
            return res.status(500).send('Bir hata oluştu.');
        }
        if(results.length>0){
            req.session.username = username;
            if (rememberMe) {
                // Kullanıcı adı ve şifreyi çerezlere ekleyin
                res.cookie("rememberMe", true, { maxAge: 900000, httpOnly: true });
                res.cookie("savedUsername", username, { maxAge: 900000, httpOnly: true });
                res.cookie("savedPassword", password, { maxAge: 900000, httpOnly: true });
            }else {
                // Remember me seçeneği iptal edildiyse çerezleri sil
                res.clearCookie("rememberMe");
                res.clearCookie("savedUsername");
                res.clearCookie("savedPassword");
            }
            req.session.redirectUsername = username;

            // Ana sayfaya yönlendir
            res.redirect("/main");
        }else{
            res.redirect("/login?error=1");
        }
        
    })
})

app.get("/logout",(req,res)=>{
    initliaze=true;
    username=undefined;
    req.session.username=undefined;
    res.render("index.ejs",{username:username, initliaze:initliaze});
})
app.get("/beginner",(req,res)=>{
    initliaze = false;
    const username = req.session.username;
    
    // Puanı almak için veritabanından sorgu yapın
    const sql = 'SELECT point FROM users WHERE username = ?';

    db.query(sql, [username], (err, results) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).send('An error occurred.');
        }

        if (results.length > 0) {
            // Kullanıcının puanı bulundu
            const puan = results[0].point;
            console.log(username);
            
            // Beginner sayfasını render edin ve puanı aktarın
            res.render("beginner.ejs", { username: username, initliaze: initliaze, puan: puan });
        } else {
            // Kullanıcı bulunamadı veya puanı yoksa varsayılan değeri kullanın
            const defaultPuan = 0;
            res.render("beginner.ejs", { username: username, initliaze: initliaze, puan: defaultPuan });
        }
    });
});
app.post("/update-point", (req, res) => {
    var username = req.session.username;
    const  {point}  = req.body;
    console.log(point);
    console.log(req.body);
    const sqlUpdatePuan = 'UPDATE users SET point = ? WHERE username = ?';
    db.query(sqlUpdatePuan, [point, username], (err, result) => {
        if (err) {
            console.error('Database error:', err.message);
            res.status(500).json({ error: 'An error occurred while updating the point.' });
        } else {
            console.log('Puan güncellendi.');
            res.status(200).json({ success: true });
        }
    });
});


app.listen(port, () => console.log(`Server running on port ${port}`));