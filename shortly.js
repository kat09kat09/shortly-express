var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var credentials = require('./credentials');
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var bcrypt= require('bcrypt-nodejs');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true}));

var genuuid = function() {
  return require('crypto').randomBytes(48).toString('hex');
};
app.use(session({
  genid: function (req) {
    return genuuid();
  },
  secret: credentials.cookieSecret,
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: credentials.passport.github.clientID,
    clientSecret: credentials.passport.github.clientSecret,
    callbackURL: "http://localhost:4568/auth/github/callback"
  },


  function(accessToken, refreshToken, profile, done) {
    new User({ githubId: profile.id }).fetch().then(function(user) {
      if (!user) {

        var addUser = new User({
          githubId: profile.id
        });

        addUser.save().then(function(newUser) {
          Users.add(newUser);
          return done(null, user);
        });
      } else {
        return done(null, user);
      }
    });
    // new User( User.findOrCreate({ githubId: profile.id }, function (err, user) {
    //   return done(err, user);
    // });
  }
));
app.use(express.static(__dirname + '/public'));

// var checkUser = function (req) {
//   return req.session.isAuthenticated === true;
// };

app.get('/auth/github',
  passport.authenticate('github')
  // function(req, res){
  //   // The request will be redirected to GitHub for authentication, so this
  //   // function will not be called.
  // }
);

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/failed' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/', ensureAuthenticated, function(req, res) {
  // if(!checkUser(req)) {
  //   res.redirect(303, '/login');
  // } else {

    res.render('index');
  // }
});

app.get('/create', ensureAuthenticated,
function(req, res) {
  // if(!checkUser(req)) {
  //   res.redirect(303, '/login');
  // } else {
    res.render('create');
  // }
});

app.get('/links', ensureAuthenticated,
function(req, res) {
  // if(!checkUser(req)) {
  //   res.redirect(303, '/login');
  // } else {
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  // }
});

app.get('/login',
function(req, res) {
  res.render('login');
});

// app.get('/signup', function (req, res) {
//   res.render('signup');
// });

app.post('/links', ensureAuthenticated,
function(req, res) {
  // if(!checkUser(req)) {
  //   res.redirect(303, '/login');
  // } else {
    var uri = req.body.url;

    if (!util.isValidUrl(uri)) {
      console.log('Not a valid url: ', uri);
      return res.send(404);
    }

    new Link({ url: uri }).fetch().then(function(found) {
      if (found) {
        res.send(200, found.attributes);
      } else {
        util.getUrlTitle(uri, function(err, title) {
          if (err) {
            console.log('Error reading URL heading: ', err);
            return res.send(404);
          }

          var link = new Link({
            url: uri,
            title: title,
            base_url: req.headers.origin
          });

          link.save().then(function(newLink) {
            Links.add(newLink);
            res.send(200, newLink);
          });
        });
      }
    });
  // }
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

//login POST
  //if user exists and credentials are good
    //set isAuthenticated to true
    //redirect to whatever page
// app.post('/login', function (req, res) {
//   var userInst = {
//     username: req.body.username,
//     password: req.body.password
//   };
//
//   new User({ username: userInst.username }).fetch().then(function(user) {
//     if (!user) {
//       res.redirect(303, '/login');
//     } else {
//       if (bcrypt.compareSync(userInst.password, user.get('password'))) {
//         req.session.isAuthenticated = true;
//         var backUrl = req.header('Referer') || '/';
//         res.redirect(backUrl);
//       }
//     }
//   });
// });

// app.get('/logout', function (req,res) {
//   req.session.isAuthenticated = false;
//   res.redirect(303, '/');
// });
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

// app.post('/signup', function (req, res) {
//   new User({
//     username: req.body.username,
//     password: req.body.password
//   }).save().then(function() {
//     req.session.isAuthenticated = true;
//     res.redirect(303, '/');
//   });
// });
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  // if(!checkUser(req)) {
  //   res.redirect(303, '/login');
  // } else  {
    new Link({ code: req.params[0] }).fetch().then(function(link) {
      if (!link) {
        res.redirect('/');
      } else {
        var click = new Click({
          link_id: link.get('id')
        });

        click.save().then(function() {
          db.knex('urls')
            .where('code', '=', link.get('code'))
            .update({
              visits: link.get('visits') + 1,
            }).then(function() {
              return res.redirect(link.get('url'));
            });
        });
      }
    });
  // }
});

console.log('Shortly is listening on 4568');
app.listen(4568);
