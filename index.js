/// <reference path="typings/index.d.ts" />
"use strict";
var requestm = require("request");
var es6_promise_1 = require("es6-promise");
var cheerio = require("cheerio");
var fs = require("fs");
var config = require('./config.json');
var request = requestm.defaults({ jar: true });
var loginUrl = "http://estudy.salle.url.edu/login/index.php";
var outputPath = __dirname + '/assignaturas/' || config.dowloadPath;
var notAllowedExt = ['webm'];
var cokkie = {};
function extensionAllowed(ext) {
    notAllowedExt.forEach(function (exten) {
        console.log('file extension: ' + ext + 'notAllowed: ' + exten);
        if (exten === ext)
            return false;
    });
    return true;
}
function getDefaultParams(url) {
    return { url: url, proxy: "", timeout: 10000 };
}
function getResource(requestParams) {
    return new es6_promise_1.Promise(function (resolve, reject) {
        request.get(requestParams, function (err, res, body) {
            if (err) {
                reject(err);
            }
            else {
                switch (res.statusCode) {
                    case 200:
                        resolve(body);
                        break;
                    default:
                        resolve(body);
                }
            }
        });
    });
}
function getBinary(requestParams) {
    requestParams['encoding'] = null;
    var response = { name: "", data: null };
    return new es6_promise_1.Promise(function (resolve, reject) {
        request.get(requestParams, function (err, res, body) {
            if (err) {
                reject(err);
            }
            else {
                switch (res.statusCode) {
                    case 200:
                        response.data = body;
                        response.name = res.headers['content-disposition'];
                        resolve(response);
                        break;
                    default:
                        response = undefined;
                        resolve(response);
                }
            }
        });
    });
}
function postResource(requestParams) {
    return new es6_promise_1.Promise(function (resolve, reject) {
        request.post(requestParams, function (err, res, body) {
            if (err) {
                es6_promise_1.Promise.reject(err);
            }
            else {
                switch (res.statusCode) {
                    case 200:
                        resolve(body);
                        break;
                    case 303:
                        resolve(res.headers['location']);
                }
            }
        });
    });
}
function logKeys(json) {
    for (var i in json) {
        console.log('key:' + i + ' -> ' + json[i]);
    }
}
function getLoginPage(url) {
    return getResource({ url: url })
        .then(function (loginPage) {
        return es6_promise_1.Promise.resolve(loginPage);
    })
        .catch(function (err) {
        return es6_promise_1.Promise.reject(err);
    });
}
function getSubjectsUrl(page) {
    var mySubjectUrl = "";
    var $ = cheerio.load(page);
    mySubjectUrl = $('div .block_course_list.block.list_block a').attr('href');
    return mySubjectUrl;
}
function getMoreSubjectsUrl(subjectsUrl) {
    var moreSubjectsUrl = "";
    return getResource({ url: subjectsUrl })
        .then(function (allSubPage) {
        var $ = cheerio.load(allSubPage);
        moreSubjectsUrl = $('div .box.notice a').attr('href');
        return es6_promise_1.Promise.resolve(moreSubjectsUrl);
    })
        .catch(function (err) {
        return es6_promise_1.Promise.reject(err);
    });
}
function parseSubjects(loginPage) {
    var subjects = [];
    var $ = cheerio.load(loginPage);
    $('div .block_course_list.block.list_block .content a').each(function (index, element) {
        var subjectName = $(element).text();
        if (subjectName) {
            var subject = {
                name: subjectName.replace("/", "-"),
                url: $(element).attr('href'),
                themes: []
            };
            subjects.push(subject);
        }
    });
    return subjects;
}
function parseThemes(subjectPage) {
    var themes = [];
    var $ = cheerio.load(subjectPage);
    // wrong selector
    $('.topics li').each(function (index, element) {
        var themeName = $(element).attr('aria-label');
        if (themeName) {
            var theme_1 = {
                name: themeName.replace("/", "-"),
                activities: []
            };
            if (isValidTheme(theme_1)) {
                themes.push(theme_1);
                console.log('Theme added: ' + theme_1.name);
                $(element).find('ul a').each(function (index, element) {
                    var activityName = $(element).text();
                    if (activityName) {
                        var activity = {
                            name: activityName,
                            extension: activityName.split(".")[1],
                            url: $(element).attr('href')
                        };
                        theme_1.activities.push(activity);
                    }
                });
            }
        }
    });
    return themes;
}
function isValidTheme(theme) {
    return (theme.name !== undefined);
}
function login(loginUrl, user) {
    var formData = {
        username: user.name,
        password: user.password
    };
    var postParams = {
        url: loginUrl,
        formData: formData
    };
    return postResource(postParams)
        .then(function (response) {
        return es6_promise_1.Promise.resolve(response);
    }).catch(function (err) {
        return es6_promise_1.Promise.reject(err);
    });
}
/*function initProfileDownload(user: User) {
    login(loginUrl, user)
        .then((locationUrl) => {
                
                getLoginPage(locationUrl)
                    .then(loginPage => {
                        let subjects: Subject[] = parseSubjects(loginPage);
                        for(let i = 0; i < subjects.length; ++i) {
                            let subject = subjects[i];
                            getResource(subject.url)
                                .then((subjectPage)) => {
                                    let themes : Theme[] = parseThemes(subjectPage);
                                    
                                        themes.forEach(theme => {
                                            theme.activities.forEach((activity,index,array) => {
                                                getBinary({url: activity.url})
                                                    .then(file => {
                                                        if(file && file.name) {
                                                            let fileNameS = file.name.split(/[""]/);
                                                            let fileName = fileNameS[1];
                                                            let fileExt = fileName.split(".")[1];
                                                            if(extensionAllowed(fileExt)) {
                                                                console.log('Saving binary: ' + fileName);
                                                                let endPath = outputPath + subject.name + "/" + theme.name + "/";
                                                                mkdirp(endPath, err => {
                                                                    fs.writeFile(endPath + fileName, file.data, err => {
                                                                        if(err) console.log('Error writing binary ' + fileName + " " + err);
                                                                    });
                                                                });
                                                            }
                                                        }
                                                    })
                                                    .catch(err => {
                                                        console.log('Write file error!' + err);
                                                        Promise.reject(err);
                                                    })
                                            })
                                                    
                                        })
                                    })
                                })
                                .catch(err => {
                                    console.log('Gettings themes error!' + err);
                                    Promise.reject(err);
                                })
                        }
                        
                    })
                    .catch((err) => {
                        console.log('Logged page error!' + err);
                    });
        })
        .catch((err) => {
            console.log('Login error! ' + err);
            return Promise.reject(err);
        });

}*/
function main() {
    var user = {
        "name": config.username,
        "password": config.password
    };
    //initProfileDownload(user);
    enableTests();
    //testThemes(subjectResponse);
    //testThemes("http://estudy.salle.url.edu/course/view.php?id=9886");
}
main();
// test functions
function enableTests() {
    //testGetTotsElsCursosUrl(fs.readFileSync('loginPage.html','utf8'));
    //testGetMoreSubjectsUrl(fs.readFileSync('loginPage.html','utf8'));
    var subjects = testParseSubjects(fs.readFileSync('loginPage.html', 'utf8'));
    console.log('Subjects: ' + subjects.length);
    var themes = testParseSubjectThemes(fs.readFileSync('subjectPage.html', 'utf8'));
    console.log('Themes: ' + themes.length);
    printObjects(themes, ['name', 'activities']);
    //let subjectsUpdated = testGetThemes(fs.readFileSync(subjects,'utf8'));
}
function testParseSubjects(loginPage) {
    return parseSubjects(loginPage);
}
function testParseSubjectThemes(subjectPage) {
    return parseThemes(subjectPage);
}
function printObjects(objects, keys) {
    objects.forEach(function (object) {
        if (keys) {
            for (var key in keys) {
                var keyName = keys[key];
                console.log(keyName, ' ', object[keyName]);
            }
        }
        else {
            for (var key in object) {
                console.log(key, ' ', object[key]);
            }
        }
    });
}
