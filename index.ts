/// <reference path="typings/index.d.ts" />

import * as requestm from "request" 
import {Promise} from "es6-promise"
import * as formData from "form-data"
import * as cheerio from "cheerio"
import * as fs from "fs"
import * as mkdirp from "mkdirp";
var config = require('./config.json')

var request = requestm.defaults({jar: true});
var syncRequest = require('sync-request');

const loginUrl: string = "http://estudy.salle.url.edu/login/index.php";
const outputPath: string = __dirname + '/assignaturas/' || config.dowloadPath;
const notAllowedExt = ['webm'];

let cokkie = {};


interface Activity {
    name: string;
    extension: string;
    url: string;
}

interface Subject {
    name: string;
    url: string;
    themes: Theme[];

}

interface Theme {
    name: string;
    activities: Activity[];
}

interface User {
    name: string;
    password: string;
}

interface BinaryResponse {
    data: Buffer;
    name: string;
}

function extensionAllowed(ext: string) {

    notAllowedExt.forEach(exten => {
        if(exten === ext) return false;
    });

    return true; 
}

function getDefaultParams(url) {
    return { url: url, proxy: "", timeout: 10000 };
}

function getResource(requestParams?: {}): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            request.get(requestParams,
                (err, res, body) => {   
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

function getBinary(requestParams?: {}): Promise<BinaryResponse> {
		requestParams['encoding'] = null;
        
        let response: BinaryResponse = { name: "", data: null};
        
        return new Promise<BinaryResponse>((resolve, reject) => {
            request.get(requestParams,
                (err, res, body) => {   
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
                                console.log('Not successful dowload: ' + res.statusCode);
                            	response = undefined;
                                resolve(response);
                        }
                    }
                });
        });
}

function getBinarySync(url: string): BinaryResponse {    
        let response: BinaryResponse = { name: "", data: null};
        var res = syncRequest('GET', url, {
            "encoding" : null
        });
        console.log('Sync StatusCode: ' + res.statusCode);
        response.name = res.headers['content-disposition'];
        response.data = res.getBody('utf8');
        console.log('File name: ' + response.name);
        return response;
}


function postResource(requestParams?: {}): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            request.post(requestParams,
                (err, res, body) => {
                     if (err) {
                     	Promise.reject(err);
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

function logKeys(json: {}) {
    for(var i in json) {
        console.log('key:' + i + ' -> ' + json[i]);
    }

}

function getLoginPage(url: string) : Promise<string> {
	return getResource({url: url})
        .then((loginPage) => {
        	return Promise.resolve(loginPage);
        })
        .catch(err => {
        	return Promise.reject(err);
        })
}

function getSubjectsUrl(page) : string {
	let mySubjectUrl: string = "";
	let $ = cheerio.load(page);
    
    mySubjectUrl = $('div .block_course_list.block.list_block a').attr('href');

    return mySubjectUrl;
}

function getMoreSubjectsUrl(subjectsUrl: string): Promise<string> {
	let moreSubjectsUrl: string = "";

	return getResource({url: subjectsUrl})
        .then((allSubPage) => {
        	let $ = cheerio.load(allSubPage);
    		moreSubjectsUrl = $('div .box.notice a').attr('href');
    		return Promise.resolve(moreSubjectsUrl);
        })
        .catch(err => {
        	return Promise.reject(err);
        })
}

function parseSubjects(loginPage) : Subject[] {
    let subjects: Subject[] = [];
    let $ = cheerio.load(loginPage);
    
    $('div .course_title a').each((index,element) => {
        let subjectName = $(element).text();

        if(subjectName) {
	    	let subject: Subject = {
	    		name: subjectName.replace("/","-"),
	    		url: $(element).attr('href'),
	    		themes: []
	    	};

	    	subjects.push(subject);
        }

    });
	return subjects;
        
}

function parseThemes(subjectPage: string) : Theme[] {
	let themes: Theme[] = []; 
    let $ = cheerio.load(subjectPage);
    // wrong selector

    $('.topics li').each((index,element) => {
        let themeName = $(element).attr('aria-label');
    	
        if(themeName) {
            let theme: Theme = {
	    		name: themeName.replace("/","-"),
	    		activities: []
	    	};

	    	if(isValidTheme(theme)) {
	    		themes.push(theme);
	    		//console.log('Theme added: ' + theme.name);

	    		$(element).find('ul a').each((index,element) => {
	    			let activityName : string = $(element).text();

                    if(activityName) {
		    			let activity: Activity = {
		    				name: activityName,
                            extension: activityName.split(".")[1],
		    				url: $(element).attr('href')
		    			};
		    			
		    			theme.activities.push(activity);
                    }
	    		});
	    	}
        }
    });

    return themes;
}

function isValidTheme(theme: Theme) {
	return (theme.name !== undefined);
}

function login(loginUrl, user: User) : Promise<string> {
        
        let formData  = {
            username: user.name,
            password: user.password
        }
            
		let postParams =  {
            url : loginUrl,
            formData : formData
	    }

    	return postResource(postParams)
    		.then((response) => {		
                return Promise.resolve(response);
    		}).catch((err) =>{
    			return Promise.reject(err);
    		});
}



function initProfileDownload(user: User) {
	login(loginUrl, user)
    	.then((locationUrl) => {
                getLoginPage(locationUrl)
                	.then(loginPage => {
                        console.log('location Url ' + locationUrl);
                		let subjects: Subject[] = parseSubjects(loginPage);
                        console.log('Subjects: ', subjects.length);
						for(let i = 0; i < subjects.length; ++i) {
							let subject = subjects[i];
							getResource(subject.url)
								.then(subjectPage => {
									let themes : Theme[] = parseThemes(subjectPage);
                                    console.log('    Subject: ', subject.name);
                                    console.log('        Themes: ', themes.length);
										themes.forEach(theme => {
                                            console.log('            Theme: ', theme.name);
                                            console.log('                Activities: ', theme.activities.length);
											theme.activities.forEach((activity,index,array) => {
												let file = getBinarySync(activity.url);
                                                if(file && file.name) {
                                                    let fileNameS = file.name.split(/[""]/);
													let fileName = fileNameS[1];
                                                    let fileExt = fileName.split(".")[1];
													if(extensionAllowed(fileExt)) {
                                                        let endPath = outputPath + subject.name + "/" + theme.name + "/" ;
                                                        console.log('Saving binary: ' + endPath + fileName);
                                                        mkdirp(endPath, err => {
                                                            fs.writeFile(endPath + fileName, file.data, err => {
                                                                if(err) console.log('Error writing binary ' + fileName + " " + err);
                                                            });
                                                        });
                                                    }
                                                }
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

}



function main() {

	let user: User = {
	    "name" : config.username,
	    "password" : config.password
	}
	
 	
	initProfileDownload(user);
	//enableTests();
	//testThemes(subjectResponse);
	//testThemes("http://estudy.salle.url.edu/course/view.php?id=9886");
    
    
}


main();


// test functions

function enableTests() {
	//testGetTotsElsCursosUrl(fs.readFileSync('loginPage.html','utf8'));
 	//testGetMoreSubjectsUrl(fs.readFileSync('loginPage.html','utf8'));
 	let subjects : Subject[] = testParseSubjects(fs.readFileSync('loginPage.html','utf8'));
 	console.log('Subjects: ' + subjects.length);
    printObjects(subjects, ['name']);
 	let themes : Theme[] = testParseSubjectThemes(fs.readFileSync('subjectPage.html','utf8'));
    //console.log('Themes: ' + themes.length);
 	//printObjects(themes, ['name', 'activities']);
 
 	//let subjectsUpdated = testGetThemes(fs.readFileSync(subjects,'utf8'));
}
function testParseSubjects(loginPage : string) : Subject[] {
	return parseSubjects(loginPage);
}

function testParseSubjectThemes(subjectPage : string) : Theme[] {
	return parseThemes(subjectPage);
}



function printObjects(objects, keys?) {
	objects.forEach(object => {
            if(keys) {
                for(var key in keys) {
                    let keyName = keys[key];
                    console.log(keyName, ' ', object[keyName]);
                }
            }
            else {
                for(var key in object) {
                    console.log(key, ' ', object[key]);
                }
            }
        
     });
}