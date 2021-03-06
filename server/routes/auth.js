const Promise = require('bluebird');
const db = require('../../db');
const Therapist = db.model('therapist');
const Patient = db.model('patient');
const router = require('express').Router();

// Role constants
const THERAPIST = 'therapist';
const PATIENT = 'patient';

// email helpers
const EmailTemplate = require('email-templates').EmailTemplate;
const utils = require('../utils');
const path = require('path');

// --------------------> '/auth/' <-----------------------

// Sign up and create a new user
// Creates the user in proper table based on req.body.role
router.post('/signup', (req, res, next) => {
  // Sets additional data based on user type
  let model, data;
  if (req.body.role === THERAPIST) {
    model = Therapist;
    data = {
      practice_name: req.body.practice_name,
      license_id: req.body.license_id,
      password: req.body.password
    };
  }
  else if (req.body.role === PATIENT) {
    model = Patient;
    data = {
      DOB: req.body.dob,
      gender: req.body.gender
    };
  }
  else {
    let error = new Error('Not a valid role');
    error.status = 422;
    return next(error);
  }

  model.create(Object.assign({
    first_name: req.body.firstName,
    last_name: req.body.lastName,
    email: req.body.email,
    img_URL: req.body.imgUrl
  }, data))
    .then(user => {
      req.session.userId = user.id;
      req.session.role = req.body.role;
      user.dataValues.role = req.body.role;

      if (!process.env.SENDGRID_API_KEY) res.status(201).send(user);

      // Send welcome email to the new therapist
      const welcome = new EmailTemplate(path.resolve(__dirname, '..', 'email_templates', 'therapist_welcome'))
      welcome.render()
      .then( renderedEmail => {
        utils.sendEmail(
          process.env.EMAIL, 							// sender
          user.email,											// recipient
          `Welcome to Steps!`,		        // subject
          renderedEmail.html,					    // html message
          "text/html",                    // type
          (statusCode, err) => {
            if (err) return next(err);
            res.status(201).send(user);
          }
        );
      })
    })
    .catch(next);
});

// Login to an existing account
router.post('/login', (req, res, next) => {
  // Search for user in Patient and Therapist tables
  Promise.all([
    Therapist.findOne({ where: { email: req.body.email } }),
    Patient.findOne({ where: { email: req.body.email } })
  ])
    .spread((therapistUser, patientUser) => {
      let user, role;
      if (therapistUser) {
        role = THERAPIST;
        user = therapistUser;
      } else if (patientUser) {
        role = PATIENT;
        user = patientUser;
      }

      // Check if input email not found
      if (!user) {
        let error = new Error('User not found');
        error.status = 401;
        return next(error);
      }

      // Check if input password matches
      return user.authenticate(req.body.password)
        .then(valid => {
          if (!valid) {
            let error = new Error('Incorrect password');
            error.status = 401;
            return next(error)
          }

          req.session.userId = user.id;
          req.session.role = role;
          user.dataValues.role = role;
          return res.send(user);
        })
    })
    .catch(next);
});

// Logout of your current session
router.delete('/logout', (req, res, next) => {
  req.session.destroy();
  res.sendStatus(204);
});

// Reestablish account on front end
router.get('/me', (req, res, next) => {
  // Get the user model based on the role in the current session (if any)
  let model;
  if (req.session.role === THERAPIST)
    model = Therapist;
  else if (req.session.role === PATIENT)
    model = Patient;
  else if (req.headers.referer === 'http://localhost:8080/' ||
    req.headers.referer === 'https://steps-app.herokuapp.com/') {
    return res.sendStatus(204)
  }
  else {
    let error = new Error('Not logged in');
    error.status = 401;
    return next(error);
  }

  // Look up and return user
  model.findById(req.session.userId)
    .then(user => {
      user.dataValues.role = req.session.role;
      res.send(user)
    })
    .catch(next);
});

module.exports = router;
