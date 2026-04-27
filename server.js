const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const pdf = require('html-pdf');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const db = new sqlite3.Database('database.db');
db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
)
`);


// Crear tabla
db.run(`
CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    body TEXT,
    parent_id INTEGER,
	hidden INTEGER DEFAULT 0,
	user_id INTEGER
)
`);



// Configurar subida de imágenes
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage });


app.post('/toggle-visibility/:id', (req, res) => {
    const id = req.params.id;

    db.run(`
        UPDATE content
        SET hidden = CASE WHEN hidden = 1 THEN 0 ELSE 1 END
        WHERE id = ?
    `, [id], function(err) {
        if (err) return res.status(500).send(err);

        res.send({ success: true });
    });
});

// Crear contenido
app.post('/content', (req, res) => {
    const { title, body, parent_id } = req.body;
    db.run(
        "INSERT INTO content (title, body, parent_id) VALUES (?, ?, ?)",
        [title, body, parent_id || null],
        function(err) {
            if (err) return res.send(err);
            res.send({ id: this.lastID });
        }
    );
});





// Obtener contenido
app.get('/content', (req, res) => {
    db.all("SELECT * FROM content", (err, rows) => {
        if (err) return res.status(500).send(err);
        res.send(rows);
    });
});
app.delete('/content/:id', (req, res) => {
    const id = req.params.id;

    db.run("DELETE FROM content WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).send(err);

        res.send({ success: true });
    });
});
// Editar contenido
app.put('/content/:id', (req, res) => {
    const { title, body } = req.body;
    db.run(
        "UPDATE content SET title=?, body=? WHERE id=?",
        [title, body, req.params.id],
        () => res.send("Actualizado")
    );
});

// Subir imagen
app.post('/upload', upload.single('image'), (req, res) => {
    res.send({ url: `/uploads/${req.file.filename}` });
});

// Exportar PDF
app.get('/pdf/:id', (req, res) => {
    const id = req.params.id;

    db.get("SELECT * FROM content WHERE id = ?", [id], (err, r) => {
        if (err || !r) return res.send("No encontrado");

      let contenido = r.body
    .replace(/src="\/uploads/g, 'src="http://localhost:3000/uploads')
    .replace(/\n/g, "<br>");

       let html = `
<html>
<head>
<style>
body {
    font-family: Arial;
    padding: 20px;
    line-height: 1.6;
}

h1 {
    color: #2c3e50;
    border-bottom: 2px solid #ccc;
}

p {
    font-size: 14px;
}

img {
    margin-top: 10px;
}
</style>
</head>

<body>
<h1>${r.title}</h1>
<p>${contenido}</p>
</body>
</html>
`;

        pdf.create(html).toBuffer((err, buffer) => {
            if (err) return res.send(err);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=contenido.pdf');
            res.send(buffer);
        });
    });
});



app.get('/', (req, res) => {
    res.send("FUNCIONA");
});
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    db.run(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, password],
        function(err) {

            if (err) {
                return res.send("Usuario ya existe");
            }

            res.send("Usuario creado");
        }
    );
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [username.trim(), password.trim()],
        (err, user) => {

            if (err) {
                return res.send({ ok:false });
            }

            if (!user) {
                return res.send({ ok:false });
            }

            res.send({
                ok:true,
                user_id:user.id,
                username:user.username
            });
        }
    );
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log("Servidor iniciado");
});
