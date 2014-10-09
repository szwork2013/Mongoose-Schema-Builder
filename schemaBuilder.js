/*
 * Schema Builder takes a short-hand JSON schema and converts it into a verbose
 * Mongoose schema.
 */

var ME       = module.exports
  , fs       = require('fs')
  , async    = require('async')
  , mongoose = require('mongoose')
  , utils    = require('./utils/utils');

/*
 * Start building the schema given in filename.
 */
ME.build = function (filename, finish) {

  async.waterfall([
    function (callback) {
      return callback(null, filename, finish);  //pass our existing values into the chain
    },
    ME.loadFile,
    ME.parseModels
  ], ME.finishBuild);

};

/*
 * Load in the file and parse it as JSON.
 */
ME.loadFile = function (filename, finish, callback) {

  fs.readFile(filename, 'utf8', function (err, data) {
    if (err) return callback(err, filename, finish);

    var schema = JSON.parse(data);

    return callback(null, filename, finish, schema);
  });

};

/*
 * Parse all models in the schema.
 */
ME.parseModels = function (filename, finish, schema, callback) {

  var mongooseModels = {};

  // Cycle models
  for (var m in schema.models) {

    // Skip prototype properties!
    if (!schema.models.hasOwnProperty(m)) continue;

    var modelDefinition = schema.models[m]
      , modelProcessed  = ME.group(schema, modelDefinition);

    // Finish the conversion of this model
    mongooseModels[m] = ME.mongooseify(modelProcessed, m);

  }

  // Finished!
  return callback(null, filename, finish, schema, mongooseModels);

};

/*
 * The final step in converting our JSON model into a Mongoose model.
 */
ME.mongooseify = function (modelProcessed, modelName) {

  var mongooseSchema = mongoose.Schema(modelProcessed, { collection: modelName }) //stop mongoose from adding an 's' to the end of the collection names!!
    , mongooseModel  = mongoose.model(modelName, mongooseSchema);

  return mongooseModel;

};

/*
 * Call the finish() callback with the result.
 */
ME.finishBuild = function (err, filename, finish, schema, models) {

  if (err) return finish(err);
  return finish(null, models);
};

/*
 * Deal with a group of properties.
 */
ME.group = function (schema, groupDefinition) {

//    console.log('group()');
//    console.log(groupDefinition);

  var newGroupDefinition = utils.extend(true, groupDefinition)
    , groupOut = {};

  // Cycle group properties (run commands first)
  for (var p1 in groupDefinition) {
    if (groupDefinition.hasOwnProperty(p1)) {

      var cmd  = p1.match(/@([a-z]+):([a-z0-9]+)/i)
        , flag = Boolean(groupDefinition[p1]);

      if (cmd) {

        // e.g. [[ "include:audit": true ]]
        if (flag) {
          switch (cmd[1]) {
            case 'include':
              var reusable = schema.reusable[cmd[2]];
              if (reusable)
                newGroupDefinition = utils.extend(true, newGroupDefinition, reusable);
              break;
          }
        }

        // Remove command statement
        delete newGroupDefinition[p1];

      }

    }
  }

  // Cycle group properties (process properties second)
  for (var p2 in newGroupDefinition) {
    if (newGroupDefinition.hasOwnProperty(p2)) {
      var propDefinition = newGroupDefinition[p2];

      groupOut[p2] = ME.property(schema, propDefinition);
    }
  }

  // Finished!
  return groupOut;

};

/*
 * Deal with an individual property.
 */
ME.property = function (schema, definition) {

//    console.log('property()');
//    console.log(definition);

  var propertyOut = {}
    , isArray     = false
    , dataTypes   = {
        "String":    String,
        "Number":    Number,
        "Integer":   Number,
        "Int":       Number,
        "Float":     Number,
        "Timestamp": Number,
        "Tstamp":    Number,
        "Boolean":   Boolean,
        "Bool":      Boolean,
        "ObjectId":  mongoose.Schema.ObjectId,
        "Ref":       mongoose.Schema.ObjectId
      };

  // Is the property an array of something?
  if (typeof definition === 'object' && typeof definition.length !== 'undefined') {
    definition = definition[0];
    isArray = true;
  }

  // Ordinary property definition
  if (typeof definition === 'string') {
    var d    = definition.match(/^([a-z0-9]+)(?::([a-z0-9]+))?(?:>([a-z0-9]+))?$/i)
      , type = null
      , opt  = null
      , dval = null
      , ref  = null;

    // Property is invalid, drop the property
    if (!d) return undefined;

    // Remember the property bits
    type = d[1];  //or undefined
    opt  = d[2];  //or undefined
    dval = d[3];  //or undefined

    // Property type is invalid, drop the property
    if (!dataTypes[type]) return undefined;

    // Special data types
    switch (type) {
      case 'Timestamp':
        if (dval && dval.toLowerCase() === 'now') dval = Date.now;
        break;

      case 'Ref':
        ref = opt;
        if (isArray) dval = undefined;
        break;
    }

    // Special default values
    switch (dval) {
      case 'null':  dval = null;  break;
      case 'true':  dval = true;  break;
      case 'false': dval = false; break;
    }

    // Property output
    var out = {
      type: dataTypes[type]
    };
    if (typeof dval !== 'undefined') out['default'] = dval;
    if (ref) out.ref = ref;

    // Store it as an array?
    if (isArray) { propertyOut = [out]; }
    else { propertyOut = out; }

  }

  // Object/array property definition
  else if (typeof definition === 'object') {

    // This is an object (NOT a sub document)
    propertyOut = ME.group(schema, definition);

    // This is a sub document!
    if (isArray) {

      // Prevent sub documents from having their own IDs
      propertyOut._id = false;

      // Force us to be an array (of sub documents)
      propertyOut = [propertyOut];

    }

  }

  // Finished!
  return propertyOut;

};