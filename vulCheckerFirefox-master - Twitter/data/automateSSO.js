function AutomateSSO(){

	this.account = 1;				//indicate which account should be used when logging in.
	var that = this;
	
	this.accountA = accounts[0];
	this.accountB = accounts[1];
	
	this.checkAppError = function(){
		console.log("automateSSO: checkAppError");
		if (document.body && document.body.innerHTML.indexOf("We're sorry, but the application you're trying to use doesn't exist or has been disabled.")!=-1) {
			self.port.emit('appError',"");
			console.log("returned true");
			return true;
		}
		if (document.body && document.body.innerHTML.indexOf("Given URL is not allowed by the Application configuration.")!=-1) {
			self.port.emit('appError',"");
			console.log("returned true");
			return true;
		}
		return false;
	}
	
	this.checkAuthPage =function() {
		console.log("automateSSO: checkAuthPage");
		if (document.URL.endsWith("authenticate") || document.URL.endsWith("authorize")) {
			console.log("returned true");
			return true;
		}
		
		return false; 

	}

	
	this.checkEnterPassword = function(){
		console.log("automateSSO: checkEnterPassword");
		if (document.URL.indexOf("https://api.twitter.com/oauth/")==-1) return false;
		
		if (document.getElementById('username_or_email') == null) return false;
		
		document.getElementById('username_or_email').value = (that.account == 1) ? accounts[0].email : accounts[1].email;	//another one is zhouyuchenking@hotmail.com
		
		if (document.getElementById('password') == null) return false;
		document.getElementById('password').value = (that.account == 1) ? accounts[0].passwd : accounts[1].passwd;
		
		if (document.getElementById('allow') == null) return false;
		self.port.emit("credentialsInserted","");			//everything ready, tell ccc we are ready to click.
		console.log("returned true");
		return true;
	};
	
	this.checkPermissionRequest = function(){
		console.log("automateSSO: checkPermissionRequest");
		if (document.URL.indexOf("https://www.facebook.com/dialog/permissions.request")==-1 && document.URL.indexOf("https://www.facebook.com/v1.0/dialog/permissions.request")==-1) return false;

		if (document.getElementsByClassName('selected layerConfirm')[0] == null) return false;

		document.getElementsByClassName('selected layerConfirm')[0].click();
		console.log("returned true");
		return true;
	};
	
	this.checkEverything = function(){
		console.log("automateSSO: checkEverything");
		//init test account name
		self.port.emit("requestFBAccount",0);
		window.setTimeout(automateSSO.checkEverything,10000);		//when the user first visits the site and the site asks for post permission, the page never refreshes and SSOScan gets stuck there.
	};
	
		
	this.checkDialogOAuth = function(){
		console.log("automateSSO: checkDialogOAuth");
		if (document.URL.indexOf("https://api.twitter.com/oauth/")==-1) {
			console.log("returned false at 1 because URL: " + document.URL);
			return false;
		}
		if (document.getElementById('allow') != null ) 
			document.getElementById('allow').click();	
		else {
			console.log("returned false at 'allow'"); 
			return false; 
		}
		/*if (document.getElementsByClassName('selected layerConfirm')[0] == null) return false;
		//try to click it
		document.getElementsByClassName('selected layerConfirm')[0].click();*/
		console.log("returned true");
		return true;
	};
	
	return this;
}

var automateSSO = new AutomateSSO();
try {
	if (document.URL.indexOf('https://www.facebook.com')!=0){
		window.moveTo(0, 0);
		window.resizeTo(screen.availWidth, screen.availHeight);
	}
} catch (ex) {console.log('window resize error, this is minor and not going into the logs.');};
//disable the following APIs for the website.
unsafeWindow.moveTo = function(){};
unsafeWindow.moveBy = function(){};
unsafeWindow.resizeTo = function(){};
unsafeWindow.resizeBy = function(){};
unsafeWindow.alert = function(){};
unsafeWindow.confirm = function(){};
//trigger by the popup menu
self.port.on("action",function(action){
		if (action == "automateSSO"){
			automateSSO.checkEverything();
		}
	}
);
self.port.on("requestFBAccount", function (response){
	if (!response.shouldAutomateSSO) return;
	if (!!response.shouldFlipAccount) {
		var temp = accounts[1];
		accounts[1] = accounts[0];
		accounts[0] = temp;
	}
	automateSSO.account = response.FBAccount;
	if (automateSSO.checkAppError()) return;
	if (automateSSO.checkAuthPage()) return; 
	//if (automateSSO.checkDialogOAuth()) return; 
	if (automateSSO.checkEnterPassword()) return; 
	//if (automateSSO.checkPermissionRequest()) return;
});

self.port.on("requestAccountInfo",function(resp){
	self.port.emit("requestAccountInfo",accounts);
});

self.port.on("goAheadAndClick",function(){
	//try to click it
	document.getElementById('allow').click();
});

//auto-check every time.
//wait until test account name is inited.
window.addEventListener('load',function(){window.setTimeout(automateSSO.checkEverything,2000);});
//window.setTimeout(automateSSO.checkEverything,2000);				//fallback if onload is not fired.	*Note*: This problem can probably be solved by writing 'run_at' : 'document.start' in manifest.json for all content scripts.