var schemaBuilder  = require('../schemaBuilder');
var mongoose       = require('mongoose');
var databaseSchema = require('ng-database-schema');

databaseSchema.prepare(function (err, schema) {

  if (err) {
    console.log('ERROR!', err);
    return;
  }

  schemaBuilder.build(mongoose, schema, function (err, mongooseModels) {

    if (err) {
      console.log('ERROR!', err);
      return;
    }

    console.log('COMPLETE!');
    console.log('Num Models:', Object.keys(mongooseModels).length);
    //console.dir(mongooseModels);

  });

});