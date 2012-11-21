/*
    discuz-recovery
    @copyright 2012  Zheng Li <lizheng@lizheng.me>
    @github https://github.com/nocoo/discuz-recovery
    @license MIT
*/

/* Run, Forest! Run! */

var mysql = require('db-mysql'),
    generic_pool = require('generic-pool');



var config = {
    'target': {
        'hostname': '192.168.115.128',
        'user': 'root',
        'password': 'root',
        'database': 'tongji_main',
        'charset': 'utf8',
        'prefix': 'pre_'
    }
};


var users = [ '93406', '187150', '2209' ];
var start_dateline = 1353109580;
start_dateline = 0;
var todo = [
    '[\[]i\=s] 本帖最后由 .* [\[]\/i]',
    '[\[]b][\[]size\=5][\[]url\=.*[\[]\/color][\[]\/url][\[]\/size][\[]\/b]'
];

exports.dbpool = generic_pool.Pool({
    name: 'mysql',
    max: 256,
    create: function(callback) {
        new mysql.Database(config.target).connect(function(error, server) { callback(error, this); });
    },
    destroy: function(db) {
        db.disconnect();
    }
});

var count = 0;

exports.get_threads = function(db, callback) {
    var tids = [];
    var sql = 'SELECT * FROM ' + config.target.prefix + 'forum_threadmod WHERE uid in (' + users.join(',') + ') AND dateline > ' + start_dateline;
    console.log(sql);

    db.query(sql).execute(function(error, rows) {
        if (error) { return console.log(error); }

        for (var i = 0, len = rows.length; i < len; ++i) {
            tids.push(rows[i].tid);
        }

        console.log('total: ' + len);

        callback(tids);
    });
};

exports.clean_thread = function(tid, db, callback) {
    //console.log('+ [' + (count++) + '] cleaning tid=' + tid);

    var sql = 'SELECT message FROM ' + config.target.prefix + 'forum_post WHERE tid = ' + tid + ' AND first = 1';
    //console.log(sql);

    var message, reg;
    db.query(sql).execute(function(error, rows) {
        if (error) { return console.log(error); }

        if (!rows.length === 0) {
            console.log('+ [' + (count++) + '] not found tid=' + tid);
            callback();
            return;
        } else {
            if (!rows[0]) {
                console.log('+ [' + (count++) + '] error tid=' + tid);
                callback();
                return;
            }

            message = rows[0]['message'];
            for (var j = 0; j < todo.length; ++j) {
                reg = new RegExp(todo[j], 'g');
                message = message.replace(reg, '');
            }

            message = message.trim();
            //console.log(message);
            //console.log('==========')

            sql = 'UPDATE ' + config.target.prefix + 'forum_post SET message = \'' + db.escape(message) + '\' WHERE tid = ' + tid + ' AND first = 1';
            //console.log(sql)
            db.query(sql).execute(function(error, rows) {
                if (error) { return console.log(error); }
                console.log('+ [' + (count++) + '] done tid=' + tid);
                callback();
            });
        }
    });
};

exports.run = function(tids, db) {
    var timeout = 5;
    var done = false;
    var index = 0, timer;

    var check = function() {
        if (!done) {
            timer = setTimeout(check, timeout);
            console.log('+ wait');
        } else {
            if (index < tids.length - 1) {
                index++;
                done = false;
                exports.clean_thread(tids[index], db, function() {
                    done = true;
                });
                timer = setTimeout(check, timeout);
                //console.log('+ next tid=' + tids[index]);
            } else {
                console.log('+ all done.');
            }
        }
    };

    exports.clean_thread(tids[index], db, function() {
        done = true;
    });

    check();
};

exports.dbpool.acquire(function(error, db) {
    if (error) { return console.log(error); }
    exports.get_threads(db, function(tids) {
        exports.run(tids, db);
    });
});
