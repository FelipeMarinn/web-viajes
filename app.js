
const express = require('express')
const app = express()
const mysql = require('mysql2')
const bodyParser = require('body-parser')
const session = require('express-session')
const flash = require('express-flash')

var pool = mysql.createPool({  
    connectionLimit: 20,  
    host: 'localhost',  
    user: 'root',  
    password: '317danii07',  
    database: 'blog_viajes' 
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.set('view engine', 'ejs')
app.use(session({ secret: 'token-muy-secreto', resave: true, saveUninitialized: true }))
app.use(flash())
app.use(express.static('public'))


app.get('/', function (peticion, respuesta) {
    pool.getConnection(function(err, connection) {
      const consulta = `
        SELECT
        titulo, resumen, fecha_hora, pseudonimo, votos
        FROM publicaciones
        INNER JOIN autores
        ON publicaciones.autor_id = autores.id
        ORDER BY fecha_hora DESC
        LIMIT 5
      `
      connection.query(consulta, function (error, filas, campos) {
        respuesta.render('index', { publicaciones: filas })
      })
      connection.release()
    })
})

app.listen(8080, function(){
    console.log("Servidor iniciado");
  });
  