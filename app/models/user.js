var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true
  // initialize: function(){
    // this.on('creating', function(model, attrs, options){
    //   // model.set('username', model.get('username'));
    //   // var promiseHash= Promise.promisify(bcrypt.hash);
    //   // return promiseHash(model.get('password'), null, null)
    //   //   .then(function (hash) {
    //   //     model.set('password', hash);
    //   //   });
    // });
  // }
});

module.exports = User;
