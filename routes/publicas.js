const express = require('express')
const router = express.Router()
const mysql = require('mysql2')
const path = require('path')
const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'damlujadre@gmail.com',
    pass: '123danii'
  }
})

var pool = mysql.createPool({
  connectionLimit: 20,
  host: 'localhost',
  user: 'root',
  password: '317danii07',
  database: 'blog_viajes'
})

function enviarCorreoBienvenida(email, nombre){
  const opciones = {
    from: 'damlujadre@gmail.com',
    to: email,
    subject: 'Bienvenido al blog de viajes',
    text: `Hola ${nombre}`
  }
  transporter.sendMail(opciones, (error, info) => {
  });
}

router.get('/', (peticion, respuesta) => {
  pool.getConnection((err, connection) => {

    let consulta
    let modificadorConsulta = ""
    let modificadorPagina = ""
    let pagina = 0
    const busqueda = ( peticion.query.busqueda ) ? peticion.query.busqueda : ""
    if (!!busqueda) {
      modificadorConsulta = `
        WHERE
        titulo LIKE '%${busqueda}%' OR
        resumen LIKE '%${busqueda}%' OR
        contenido LIKE '%${busqueda}%'
      `
      modificadorPagina = ""
    } 
    else {
      pagina = ( peticion.query.pagina ) ? parseInt(peticion.query.pagina) : 0
      if (pagina < 0) {
        pagina = 0
      }
      modificadorPagina = `
      LIMIT ${ pagina * 5 }, 5
      `
    }

    consulta = `
      SELECT
      titulo, resumen, fecha_hora, pseudonimo, votos, publicaciones.id, avatar
      FROM publicaciones
      INNER JOIN autores
      ON publicaciones.autor_id = autores.id
      ${modificadorConsulta}
      ORDER BY fecha_hora DESC
      ${modificadorPagina}
    `
    connection.query(consulta, (error, filas, campos) => {
      respuesta.render('index', { publicaciones: filas, busqueda: busqueda, pagina: pagina })
    })
    connection.release()
  })
})

router.get('/publicacion/:id', (peticion, respuesta) => {
  pool.getConnection((err, connection) => {

    let consulta

    consulta = `
    SELECT *
    FROM publicaciones
    WHERE publicaciones.id = ${peticion.params.id}
    `

    connection.query(consulta, (error, filas, campos) => {
      if ( !filas.length > 0 ) {
        respuesta.redirect('/')
      } else {

        consulta = `
        SELECT
        titulo, resumen, contenido, fecha_hora, pseudonimo, votos, publicaciones.id
        FROM publicaciones
        INNER JOIN autores
        ON publicaciones.autor_id = autores.id
        WHERE publicaciones.id = ${peticion.params.id}
      `
        connection.query(consulta, (error, filas, campos) => {
          respuesta.render('publicacion', { publicacion: filas[0] })    
        })
 
      }    
   
    })
    connection.release()
  })
})

router.get('/publicacion/:id/votar', (peticion, respuesta) => {
  pool.getConnection((err, connection) => {
    const consulta = `
      SELECT *
      FROM publicaciones
      WHERE id = ${connection.escape(peticion.params.id)}
    `
    connection.query(consulta, (error, filas, campos) => {
      if (filas.length > 0) {
        const consultaVoto = `
          UPDATE publicaciones
          SET
          votos = votos + 1
          WHERE id = ${connection.escape(peticion.params.id)}
        `
        connection.query(consultaVoto, (error, filas, campos) => {
          respuesta.redirect(`/publicacion/${peticion.params.id}`)
        })
      }
      else {
        peticion.flash('mensaje', 'Publicación inválida')
        respuesta.redirect('/')
      }
    })
    connection.release()
  })
})

router.get('/registro', (peticion, respuesta) => {
  respuesta.render('registro', { mensaje: peticion.flash('mensaje') })
})

router.post('/procesar_registro', (peticion, respuesta) => {
  pool.getConnection((err, connection) => {
    const email = peticion.body.email
    const pseudonimo = peticion.body.pseudonimo
    const contrasena = peticion.body.contrasena
    const consultaEmail = `
      SELECT *
      FROM autores
      WHERE email = ${connection.escape(email)}
    `
    connection.query(consultaEmail, (error, filas, campos) => {
      if (filas.length > 0) {
        peticion.flash('mensaje', 'Email duplicado')
        respuesta.redirect('/registro')
      }
      else {
        const consultaPseudonimo = `
          SELECT *
          FROM autores
          WHERE pseudonimo = ${connection.escape(pseudonimo)}
        `
        connection.query(consultaPseudonimo, (error, filas, campos) => {
          if (filas.length > 0) {
            peticion.flash('mensaje', 'Pseudonimo duplicado')
            respuesta.redirect('/registro')
          }
          else {
            const consulta = `
                                INSERT INTO
                                autores
                                (email, contrasena, pseudonimo)
                                VALUES (
                                  ${connection.escape(email)},
                                  ${connection.escape(contrasena)},
                                  ${connection.escape(pseudonimo)}
                                )
                              `
            connection.query(consulta, (error, filas, campos) => {
              if (peticion.files && peticion.files.avatar){

                // nombre del archivo subido
                const archivoAvatar = peticion.files.avatar
                const id = filas.insertId // id que se inserto al crear la tabla
                // estraemos el nombre del archivo y le agregamos la extencion al id
                // id.png
                const nombreArchivo = `${id}${path.extname(archivoAvatar.name)}`
                // movemos el archivo a la caperta public
                archivoAvatar.mv(`./public/avatars/${nombreArchivo}`, (error) => {
                  // actualizamos el nombre del avatar
                  const consultaAvatar = `
                                UPDATE
                                autores
                                SET avatar = ${connection.escape(nombreArchivo)}
                                WHERE id = ${connection.escape(id)}
                              `
                  connection.query(consultaAvatar, (error, filas, campos) => {
                    enviarCorreoBienvenida(email, pseudonimo)
                    peticion.flash('mensaje', 'Usuario registrado con avatar')
                    respuesta.redirect('/registro')
                  })
                })
              }
              else{
                enviarCorreoBienvenida(email, pseudonimo)
                peticion.flash('mensaje', 'Usuario registrado')
                respuesta.redirect('/registro')
              }
            })
          }
        })
      }
    })
    connection.release()
  })
})

router.get('/inicio', (peticion, respuesta) => {
  respuesta.render('inicio', { mensaje: peticion.flash('mensaje') })
})

router.post('/procesar_inicio', (peticion, respuesta) => {
  pool.getConnection((err, connection) => {
    const consulta = `
      SELECT *
      FROM autores
      WHERE
      email = ${connection.escape(peticion.body.email)} AND
      contrasena = ${connection.escape(peticion.body.contrasena)}
    `
    connection.query(consulta, (error, filas, campos) => {
      if (filas.length > 0) {
        peticion.session.usuario = filas[0]
        respuesta.redirect('/admin/index')
      }
      else {
        peticion.flash('mensaje', 'Datos inválidos')
        respuesta.redirect('/inicio')
      }
    })
    connection.release()
  })
})

router.get('/autores', (peticion, respuesta) => {
  pool.getConnection((err, connection) => {
    const consulta = `
      SELECT autores.id id, pseudonimo, avatar, titulo, publicaciones.id publicacion_id
      FROM autores 
      INNER JOIN publicaciones 
      ON autores.id = publicaciones.autor_id 
      ORDER BY autores.id DESC, publicaciones.fecha_hora DESC
    `
    connection.query(consulta, (error, filas, campos) => {
      
      autores = []
      ultimoAutorId = undefined
      filas.forEach(registro => {
        if (registro.id != ultimoAutorId){
          ultimoAutorId = registro.id
          autores.push({
            id: registro.id,
            pseudonimo: registro.pseudonimo,
            avatar: registro.avatar,
            publicaciones: []
          })
        }
        autores[autores.length-1].publicaciones.push({
          id: registro.publicacion_id,
          titulo: registro.titulo
        })
      })
      console.log(autores)

      respuesta.render('autores', { autores: autores })
    })

    connection.release()
  })
})


module.exports = router
