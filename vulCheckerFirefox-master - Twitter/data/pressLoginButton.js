var log = function (str){
	if (debug) console.log(str);
	if (self.port) self.port.emit("writeToFileRequest",str);
}

function VulCheckerHelper() {

	var that = this;
	//options
	this.tryFindInvisibleLoginButton = false;
	this.searchForSignUpForTwitter = false;
	this.indexToClick = 0;
	this.relaxedStringMatch = false;
	this.searchUpperRight = false;
	this.candidatesWithPreviousCriteria = "";
	this.searchingUsingPreviousCriteria = false;
	this.maxCandidatesAllowedEachStrategy = 5;
	
	this.account = [];
	//this.clickedButtons = [];
	this.userInfoFound = false;
	this.loginClickAttempts = 0;
	this.results = {};					//used to store candidate information.
	this.rightEdge = 1920;
	
	hashCode = function(s){
		return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);              
	}
	
	function createCookie(name,value,days) {
		if (days) {
			var date = new Date();
			date.setTime(date.getTime()+(days*24*60*60*1000));
			var expires = "; expires="+date.toGMTString();
		}
		else var expires = "";
		document.cookie = name+"="+value+expires+"; domain=.huffingtonpost.com; path=/";
	}

	function eraseCookie(name) {
		createCookie(name,"",-1);
	}

	function eraseAllCookies() {
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++) eraseCookie(cookies[i].split("=")[0]); localStorage.clear();
	}

	function calculateScore(inputStr)
	{
		
		return calculateTwitterScore(inputStr);
	}

	function calculateTwitterScore(inputStr)
	{
		var output = 0;
		var i = 0;
		if (that.loginClickAttempts == 0) {
			output = (inputStr.match(/twitter/gi)!=null) ? inputStr.match(/twitter/gi).length * 3 : 0;
			that.stringSig[0] += (inputStr.match(/twitter/gi)!=null) ? inputStr.match(/twitter/gi).length : 0;
			that.stringSig[1] += (inputStr.match(/twitter/gi)!=null) ? inputStr.match(/twitter/gi).length : 0;
		}
		else if (that.loginClickAttempts > 0) {
			//after the first click, the page/iframe supposedly should nav to a sign-in heavy content, in this case we should emphasize on facebook string detection, instead of 'sign in' pattern.
	
			output = (inputStr.match(/twitter/gi)!=null) ? 5 * inputStr.match(/twitter/gi).length : 0;
			that.stringSig[0] += (inputStr.match(/twitter/gi)!=null) ? inputStr.match(/twitter/gi).length : 0;
			that.stringSig[1] += (inputStr.match(/twitter/gi)!=null) ? inputStr.match(/twitter/gi).length : 0;
		}
		//bonus to fb and login existing both.
		that.hasTwitter = that.hasTwitter || (inputStr.match(/twitter/gi)!=null);
		
		if (!that.searchForSignUpForTwitter)
		{
			var temp;
			var regexes = [/log[\s-_]?[io]n/gi, /sign[\s-_]?[io]n/gi, /connect$|connect[^a-zA-Z]/gi];	
			var regexWeights = [];
			if (that.loginClickAttempts == 0){
				regexWeights = [4,3,2,5,2,2];
			}
			else {
				regexWeights = [2,1,5,4,0,0];
			}
			//"connect" is a more common word, we need to at least restrict its existence, for example, we want to rule out "Connecticut" and "connection".
			if (that.relaxedStringMatch) {
				regexes = regexes.concat([/oauth/gi, /account$|account[^a-zA-Z]/gi, /forum/gi]);		//so is 'account'
				for (i = 0; i < regexes.length; i++)
				{
					temp = inputStr.match(regexes[i]);
					output += (temp!=null) ? temp.length * regexWeights[i] : 0;
					that.stringSig[i+2] += (temp!=null) ? temp.length : 0;
					that.hasLogin = that.hasLogin || temp!=null;
				}
			}
			else {
				for (i = 0; i < regexes.length; i++)
				{
					temp = inputStr.match(regexes[i]);
					output += (temp!=null) ? temp.length * regexWeights[i] : 0;
					that.hasLogin = that.hasLogin || temp!=null;
				}
				regexes = regexes.concat([/oauth/gi, /account$|account[^a-zA-Z]/gi, /forum/gi]);
				for (i = 0; i < regexes.length; i++)
				{
					temp = inputStr.match(regexes[i]);
					that.stringSig[i+2] += (temp!=null) ? temp.length : 0;			//although we don't count them into score, still want to know the distribution.
				}
			}
		}
		else {
			var regexes = [/oauth/gi, /sign[\s-_]?up/gi, /register/gi, /create/gi, /join/gi];
			var temp;
			for (i = 0; i < regexes.length; i++)
			{
				temp = inputStr.match(regexes[i]);
				output += ((temp!=null) ? temp.length : 0);
				that.hasLogin = that.hasLogin || (temp!=null);
			}			
		}
		
		//penalty on google/facebook/other sso idp
		var otherIdPRegexes = [/google/gi, /facebook/gi];
		for (i = 0; i < otherIdPRegexes.length; i++)
		{
			temp = inputStr.match(otherIdPRegexes[i]);
			that.hasOtherIdP = that.hasOtherIdP || (temp!=null);
		}
		//penalty on share/like
		that.hasLikeOrShare = that.hasLikeOrShare || (inputStr.match(/share/gi)!=null || inputStr.match(/like/gi)!=null);
		//log("Calculate Twitter Score: " + inputStr + " = " + output);
		return output;
	}

	function AttrInfoClass(thisNode, thisScore, thisStringSig) {
		this.node = thisNode;
		this.score = thisScore;
		this.stringSig = thisStringSig;
		this.strategy = -1;
		this.worker = null;
		return this;
	}
	
	this.isChildElement = function(parent, child){
		if (child == null) return false;
		if (parent == child) return true;
		if (parent == null || typeof parent == "undefined") return false;
		if (parent.children.length == 0) return false;
		var i = 0;
		for (i = 0; i < parent.children.length; i++)
		{
			if (that.isChildElement(parent.children[i],child)) return true;
		}
		return false;
	}
	
	this.tryAnotherStrategy = function(){
		if (!that.tryFindInvisibleLoginButton && !that.relaxedStringMatch){
			that.tryFindInvisibleLoginButton = true;
			return true;
		}
		if (that.tryFindInvisibleLoginButton && !that.relaxedStringMatch){
			that.tryFindInvisibleLoginButton = false;
			that.relaxedStringMatch = true;
			return true;
		}
		if (!that.tryFindInvisibleLoginButton && that.relaxedStringMatch){
			that.tryFindInvisibleLoginButton = true;
			that.relaxedStringMatch = true;
			return true;
		}
		if (that.tryFindInvisibleLoginButton && that.relaxedStringMatch && !that.searchUpperRight && that.loginClickAttempts == 0){
			//only valid for the first click.
			that.searchUpperRight = true;
			return true;
		}
		return false;			//no other strategies available
	};
	
	this.onTopLayer = function(ele){
		//This doesn't really work on section/canvas HTML5 element. TODO:Fix this.
		//given an element, returns true if it's likely to be on the topmost layer, false if otherwise.
		if (!ele) return false;
		var document = ele.ownerDocument;
		var inputWidth = ele.offsetWidth;
		var inputHeight = ele.offsetHeight;
		if (inputWidth <= 0 || inputHeight <= 0) return false;			//Elements that are on top layer must be visible.
		var position = $(ele).offset();
		var j;
		var score = 0;
		//The following three lines of code is commented out because we assume the login button is on the active display (initial scroll position)
		// ele.scrollIntoView();
		// position.top = position.top - window.pageYOffset;
		// position.left = position.left - window.pageXOffset;
		//Don't judge the input unfairly because of the screen/browser window size.
		var maxHeight = (document.documentElement.clientHeight - position.top > inputHeight)? inputHeight : document.documentElement.clientHeight - position.top;
		var maxWidth = (document.documentElement.clientWidth > inputWidth)? inputWidth : document.documentElement.clientWidth - position.left;
		//Instead of deciding it on one try, deciding it on 10 tries.  This tackles some weird problems.
		for (j = 0; j < 10; j++)
		{
			score = that.isChildElement(ele,document.elementFromPoint(position.left+1+j*maxWidth/10, position.top+1+j*maxHeight/10)) ? score + 1 : score;
		}
		if (score >= 5) return true;
		else return false;
	}
	
	function preFilter(curNode) {
		if (curNode.nodeName != "A" && curNode.nodeName != "DIV" && curNode.nodeName != "SPAN" && curNode.nodeName != "IMG" && curNode.nodeName != "INPUT" && curNode.nodeName != "BUTTON") {
			//log("prefilter: failed at 1" + "curNode: " + curNode.nodeName);
			return false;
		}
		if (curNode.nodeName == "INPUT") {
			if (curNode.type != "button" && curNode.type != "image" && curNode.type != "submit") {
				//log("prefilter: failed at 2" + "curNode: " + curNode.nodeName);
				return false;
			}
		}
		if (curNode.nodeName == "A") {
			if (curNode.href.toLowerCase().indexOf('mailto:') == 0) {
				log("prefilter: failed at 3" + "curNode: " + curNode.nodeName);
				return false;
			}
		}
		/*if (that.clickedButtons.indexOf(that.getXPath(curNode)) != -1 && !that.searchingUsingPreviousCriteria) {
			//avoiding clicking on the same button twice, now ignoring the duplicate button...
			//but when reporting previous candidates, don't care about this.
			return false;
		}*/
		//log ("preFilter: that.tryFindInvisibleLoginButton: " + that.tryFindInvisibleLoginButton + " that.onTopLayer(curNode): " + that.onTopLayer(curNode));
		//return true; 
		return (that.tryFindInvisibleLoginButton || that.onTopLayer(curNode));
	}
	
	function computeAsRoot(curNode)
	{
		
		//log("computeAsRoot(NOT IFRAME): curNode: " + curNode);
		if (curNode == null || curNode.attributes == null || curNode.nodeName == "SCRIPT" || curNode.nodeName == "EMBED" ) {
			//log("Rejected 1"); 
			return;		//ignore all script and embed elements
		}
		if (curNode.nodeName.toLowerCase().indexOf("fb:")!=-1) {
			//log("Rejected b/c fb"); 
			return;				//to indicate if this tag is fb: something, we want to rule out those.
		}
		
		//pre filter out buttons that are in the background, input whose type is not submit
		if (preFilter(curNode)) {
			//log("Got to here!");
			var i = 0;
			var curScore = 0;
			that.hasTwitter = false;									//to indicate if this element has facebook-meaning term.
			that.hasLogin = false;								//to indicate if this element has login-meaning term.
			that.hasLikeOrShare = false;						//to indicate if this element has share/like word.
			that.hasOtherIdP = false;							//to indicate if this element includes other IdP's phrases.
			that.stringSig = Array.apply(null, new Array(8)).map(Number.prototype.valueOf,0);
			for (i = 0; i < curNode.attributes.length; i++)
			{
				var temp = curNode.attributes[i].name + "=" + curNode.attributes[i].value + ";"
				curScore += calculateScore(temp);
				//log("computeAsRoot(NOT IFRAME):" + temp + " / Score: [" + curScore + "]");
			}
			var curChild = curNode.firstChild;
			while (curChild != null && typeof curChild != "undefined")
			{
				if (curChild.nodeType == 3) curScore = curScore + calculateScore(curChild.data);
				curChild = curChild.nextSibling;
			}
			if (that.hasLogin) curScore += 4;												//this is used to offset a lot of 'follow us on facebook' buttons.
			if (that.hasTwitter && that.hasLogin) curScore += 4;									//extra score if both terms are found.
			
			//modifiers due to button types and positions.
			if (that.loginClickAttempts == 0) {
				if ((curNode.nodeName == "BUTTON" || curNode.nodeName == "INPUT" || curNode.nodeName == "A" || curNode.nodeName == "SPAN") && curScore > 0) curScore += 2;
				if (Math.abs(that.rightEdge - $(curNode).offset().left - curNode.offsetWidth) < 100 && $(curNode).offset().top < 50) {
					//in the top left corner, give it more weight.
					curScore *= 2
				}
			}
			else {
				if ((curNode.nodeName == "BUTTON" || curNode.nodeName == "SPAN" || curNode.nodeName == "IMG") && curScore > 0) curScore += 2;
				if ($(curNode).offset().top < 50 || $(curNode).offset().top > 700) {
					//in the top or bottom, not middle, give it LESS weight for the SECOND click.
					curScore /= 2
				}
			}
			
			//log("computeAsRoot(NOT IFRAME): before penalties score: " + curScore); 
			//penalties come last.
			if (that.hasLikeOrShare && !that.hasLogin) curScore = -1;						//ignore like or share button without login.
			if (that.hasLikeOrShare && that.hasLogin) curScore = 1;							//if it has both, reduce the score to the minimum(serve as backup)
			if (that.hasOtherIdP) curScore = 1;												//if it has other phrases, penalize it.
			if ((curNode.offsetHeight > 150 || curNode.offsetWidth > 400) && curNode.nodeName != "BUTTON" && curNode.nodeName != "A" ) curScore = -1;		//ignore non-A and non-Button type login buttons that are too large, they may just be overlays.
			if (!that.tryFindInvisibleLoginButton) {if (curNode.offsetWidth <= 0 || curNode.offsetHeight <= 0) curScore = -1;}		//ignore invisible element.
			
			var temp = new AttrInfoClass(curNode, curScore, that.stringSig.join("|"));
			that.AttrInfoMap[that.count] = temp;
			that.count++;
		}
		else {
			//log("Prefilter: fail!");
		}
			
		if (curNode.nodeName == "IFRAME"){
			//ignore iframe, but check its children, since it could have lots of fb/facebook in its url as false positive.
			try {curNode = curNode.contentDocument.body || curNode.contentWindow.document.body;} catch(ex){
				//Do nothing here. If it violates SOP we just ignores it.
				//If we do not catch anything, console is going to output [object object] for each violation.
			}
		}
		for (i = 0; i <curNode.children.length; i++)
		{
			//log("Checking children of " + curNode + " / " + i);
			computeAsRoot(curNode.children[i]);
			//log("Done checking children of " + curNode + " / " + i);
			}
		
	}

	this.getMargin = function(){
		rightEdge = 1920;
		
		
		rightEdges = [];
		leftEdges = [];
		function collectEdges(node){
			var i;
			if (!node) return;
			if (node.offsetHeight != 0 && node.offsetWidth != 0){
				var position = $(node).offset();
				if (position.top + node.offsetHeight <= document.documentElement.clientHeight/4) {
					rightEdges.push(Math.floor(position.left + node.offsetWidth));
					leftEdges.push(Math.floor(position.left));
				}
			}
			for (i = 0; i < node.children.length; i++){
				collectEdges(node.children[i]);
			}
		}

		collectEdges(document.body);

		leftEdges = leftEdges.sort(function(a,b){return a-b});
		rightEdges = rightEdges.sort(function(a,b){return a-b});
		biggestDiff = -1;
		r_i = -1;
		for (i = 0; i < rightEdges.length - 1; i++)
		{
			if (rightEdges[i] <= document.documentElement.clientWidth/2) continue;			//right edge cannot be on the left side of the page.
			if (rightEdges[i] <= leftEdges[leftEdges.length-1]) continue;					//there should not be another element starting right of rightmost edge.
			if (biggestDiff < rightEdges[i+1] - rightEdges[i]) {
				biggestDiff = rightEdges[i+1] - rightEdges[i];
				rightEdge = rightEdges[i];
				r_i = i;
			}
		}
		
		if (rightEdge == 1920 && rightEdges[rightEdges.length-1] < 1920) rightEdge = rightEdges[rightEdges.length-1];			//no edge.
		return rightEdge;
	}

	function checkAccountInfoPresense(node){
		var fullContent = node.innerHTML.toLowerCase();
		var re = /_gig_llu=.*?;/
		var temp = document.cookie;
		fullContent = fullContent + temp.replace(re,'').toLowerCase();
		var i = 0;
		for (i = 0; i < that.account.length; i++){
			if (fullContent.indexOf(that.account[i].fbid)!=-1) return true;
			if (fullContent.indexOf(that.account[i].firstName)!=-1) return true;
			if (fullContent.indexOf(that.account[i].lastName)!=-1) return true;
			if (fullContent.indexOf(that.account[i].email)!=-1) return true;
			if (fullContent.indexOf(that.account[i].picSRC)!=-1) return true;
			if (fullContent.indexOf(that.account[i].picSRC2)!=-1) return true;
			if (fullContent.indexOf(that.account[i].picSRC3)!=-1) return true;
			if (fullContent.indexOf(that.account[i].picSRC4)!=-1) return true;
		}
		return false;
	}
	
	this.searchForLoginButton = function(rootNode) {
		that.init();
		if (checkAccountInfoPresense(rootNode)) {
			that.userInfoFound = true;
			return;
		}
		if (document.URL.indexOf('http://www.twitter.com/') == 0 || document.URL.indexOf('https://www.twitter.com/') == 0) {
			
			if (document.URL.indexOf('http://www.twitter.com/login/') == -1 && document.URL.indexOf('https://www.twitter.com/login/') == -1) {
				//These are URLs that we must not try to find login button in.
				return;
			} 
		}
		/*if (document.URL.indexOf('http://api.twitter.com/oauth/authenticate') == 0 || document.URL.indexOf('https://api.twitter.com/oauth/authenticate') == 0){
			return;
		}*/
		if (!that.searchUpperRight){
			computeAsRoot(rootNode);
		}
		else {
			var candidates = getUpperRightCorner();
			var i;
			for (i = 0; i < candidates.length; i++)
			{
				var temp = new AttrInfoClass(candidates[i], 3-i, "NA|NA|NA|NA|NA|NA|NA|NA");
				that.AttrInfoMap[that.count] = temp;
				that.count++;
			}
		}
		//sort
		var i = 0;
		var j = 0;
		for (i = 0; i < that.count; i++)
		{
			max = 0;
			maxindex = -1;
			for (j = 0; j < that.count; j++)
			{
				if (that.AttrInfoMap[j].score > max) {
					max = that.AttrInfoMap[j].score;
					maxindex = j;
				}
			}
			if (max == 0) {break;}
			else {
				that.sortedAttrInfoMap[i] = new AttrInfoClass(that.AttrInfoMap[maxindex].node, that.AttrInfoMap[maxindex].score, that.AttrInfoMap[maxindex].stringSig);
				that.AttrInfoMap[maxindex].score = -1;
			}
		}
		//From each strategy, obtain at most that.maxCandidatesAllowedEachStrategy candidates.
		that.sortedAttrInfoMap.splice(that.maxCandidatesAllowedEachStrategy, that.sortedAttrInfoMap.length);
	}

	var getUpperRightCorner = function(){
		var curX = document.documentElement.clientWidth - 1;
		var curY = 2;
		var candidates = [];
		var excluded = [];				//underlays
		
		while (candidates.length < 3){
			var node = document.elementFromPoint(curX,curY);
			if (!!node && node.offsetWidth < 300 && node.offsetHeight < 150 && candidates.indexOf(node)==-1 && that.onTopLayer(node) && excluded.indexOf(node)==-1) {
				var i = 0;
				for (i = 0; i < candidates.length; i++)
				{
					if (that.isChildElement(candidates[i],node)) {
						excluded.push(candidates.splice(i,1)[0]);
					}
				}
				candidates.push(node);
			}
			curX--;
			if (curX < document.documentElement.clientWidth/2) 				//left side of the page
			{
				curX = document.documentElement.clientWidth - 1;
				curY += 5;
			}
			if (curY > document.documentElement.clientHeight/4)
			{
				break;
			}
		}
		return candidates;
	}
	
	this.getPreviousCandidates = function(){
		that.flattenedResults = new Array();
		that.results = new Array();		//clean results in case this is a second click attempt and the first click did not navigate the page.
		that.tryFindInvisibleLoginButton = false;			//reset strategy
		that.relaxedStringMatch = false;
		that.searchUpperRight = false;
		var curStrategy = 0;
		while (true){
			that.searchForLoginButton(document.body);
			that.results[curStrategy] = that.sortedAttrInfoMap;
			curStrategy++;
			if (!that.tryAnotherStrategy() || that.userInfoFound) break;
		}
		if (that.userInfoFound){
			return "-1";
		}
		//TODO:flatten the results, get rid of duplicates and populate strategy field.
		var pointers = Array.apply(null, new Array(curStrategy)).map(Number.prototype.valueOf,0);
		var i;
		var j;
		var maxScore;
		var maxNode;
		var maxStrategy;
		var maxXPath;
		var maxOuterHTML;
		var maxStringSig;
		var breakFlag;
		var dupFlag;
		while (true){
			maxScore = -999;
			maxStrategy = -1;
			breakFlag = 0;
			//merge all sorted arrays.
			for (j = 0; j < curStrategy; j++)
			{
				if (that.results[j].length == 0 || pointers[j] >= that.results[j].length) {
					//this strategy already depleted and merged, go to the next strategy
					breakFlag++;
					continue;
				}
				if (maxScore < that.results[j][pointers[j]].score){
					maxScore = that.results[j][pointers[j]].score;
					maxNode = that.results[j][pointers[j]].node;
					maxXPath = that.getXPath(that.results[j][pointers[j]].node);
					maxOuterHTML = that.results[j][pointers[j]].node.outerHTML;
					maxStringSig = that.results[j][pointers[j]].stringSig;
					maxStrategy = j;
				}
			}
			if (maxStrategy != -1){
				dupFlag = false;
				for (i = 0; i < that.flattenedResults.length; i++)
				{
					if (that.flattenedResults[i].node == maxNode) {
						that.flattenedResults[i].stats = that.flattenedResults[i].stats + "," + maxStrategy.toString() + "/" + pointers[maxStrategy].toString();
						dupFlag = true;
						break;
					}
				}
				if (!dupFlag){		
					//avoid duplicate candidate (another strategy is to boost duplicate's score, but we can worry about this later.
					that.flattenedResults.push({
						score: maxScore, 
						node: maxNode, 
						strategy: maxStrategy,
						stringSig: maxStringSig,
						XPath: maxXPath,
						outerHTML: maxOuterHTML,
						original_index: that.flattenedResults.length,
						score: maxScore,
						stats: maxStrategy.toString() + "/" + pointers[maxStrategy].toString(),			//this is for USENIX experiment purposes.
						iframe: false,
						visible: that.onTopLayer(maxNode),
						width: Math.floor(maxNode.offsetWidth),
						height: Math.floor(maxNode.offsetHeight),
						type: maxNode.nodeName,
						x: Math.floor($(maxNode).offset().left),
						y: Math.floor($(maxNode).offset().top)
					});
				}
				pointers[maxStrategy]++;
			}
			if (breakFlag == curStrategy) break;
		}
		return that.flattenedResults.map(function(ele,index,arr){return ele.XPath+ele.width.toString()+ele.height.toString()+ele.visible.toString()+ele.x.toString()+ele.y.toString();}).sort().join("\n");			//for console debugging purposes.
	}
	
	this.reportCandidates = function(){
		if (that.loginClickAttempts > 0){
			that.searchingUsingPreviousCriteria = true;
			that.loginClickAttempts--;		//temporarily decrease this by one, we know it's always greater than 1.
			that.candidatesWithPreviousCriteria = that.getPreviousCandidates();
			that.searchingUsingPreviousCriteria = false;
			that.loginClickAttempts++;		//reset it
		}
		that.flattenedResults = new Array();
		that.results = new Array();		//clean results in case this is a second click attempt and the first click did not navigate the page.
		that.tryFindInvisibleLoginButton = false;			//reset strategy
		that.relaxedStringMatch = false;
		that.searchUpperRight = false;
		var curStrategy = 0;
		while (true){
			that.searchForLoginButton(document.body);
			that.results[curStrategy] = that.sortedAttrInfoMap;
			curStrategy++;
			if (!that.tryAnotherStrategy() || that.userInfoFound) break;
		}
		if (that.userInfoFound){
			self.port.emit("reportCandidates",{result:[{
				score: -999, 
				node: null,
				strategy: null,
				XPath: "USER_INFO_EXISTS!",
				outerHTML: "USER_INFO_EXISTS!",
				original_index: 0
			}], candidatesWithPreviousCriteria:"-1", candidatesWithCurrentCriteria:"-1", url:(document.URL.indexOf("?")==-1?document.URL:document.URL.substr(0,document.URL.indexOf("?")))});
			return;
		}
		//TODO:flatten the results, get rid of duplicates and populate strategy field.
		var pointers = Array.apply(null, new Array(curStrategy)).map(Number.prototype.valueOf,0);
		var i;
		var j;
		var maxScore;
		var maxNode;
		var maxStrategy;
		var maxXPath;
		var maxOuterHTML;
		var maxStringSig;
		var breakFlag;
		var dupFlag;
		while (true){
			maxScore = -999;
			maxStrategy = -1;
			breakFlag = 0;
			//merge all sorted arrays.
			for (j = 0; j < curStrategy; j++)
			{
				if (that.results[j].length == 0 || pointers[j] >= that.results[j].length) {
					//this strategy already depleted and merged, go to the next strategy
					breakFlag++;
					continue;
				}
				if (maxScore < that.results[j][pointers[j]].score){
					maxScore = that.results[j][pointers[j]].score;
					maxNode = that.results[j][pointers[j]].node;
					maxXPath = that.getXPath(that.results[j][pointers[j]].node);
					maxOuterHTML = that.results[j][pointers[j]].node.outerHTML;
					maxStringSig = that.results[j][pointers[j]].stringSig;
					maxStrategy = j;
				}
			}
			if (maxStrategy != -1){
				dupFlag = false;
				for (i = 0; i < that.flattenedResults.length; i++)
				{
					if (that.flattenedResults[i].node == maxNode) {
						that.flattenedResults[i].stats = that.flattenedResults[i].stats + "," + maxStrategy.toString() + "/" + (pointers[maxStrategy]+1).toString();
						dupFlag = true;
						break;
					}
				}
				if (!dupFlag){		
					//avoid duplicate candidate (another strategy is to boost duplicate's score, but we can worry about this later.
					that.flattenedResults.push({
						score: maxScore, 
						node: maxNode, 
						strategy: maxStrategy,
						stringSig: maxStringSig,
						XPath: maxXPath,
						outerHTML: maxOuterHTML,
						original_index: that.flattenedResults.length,
						score: maxScore,
						stats: maxStrategy.toString() + "/" + (pointers[maxStrategy]+1).toString(),			//this is for USENIX experiment purposes.
						iframe: false,
						visible: that.onTopLayer(maxNode),
						width: Math.floor(maxNode.offsetWidth),
						height: Math.floor(maxNode.offsetHeight),
						type: maxNode.nodeName,
						x: Math.floor($(maxNode).offset().left),
						y: Math.floor($(maxNode).offset().top)
					});
				}
				pointers[maxStrategy]++;
			}
			if (breakFlag == curStrategy) break;
		}
		if (self.port) self.port.emit("reportCandidates",{result:that.flattenedResults, candidatesWithPreviousCriteria:that.candidatesWithPreviousCriteria, candidatesWithCurrentCriteria:that.flattenedResults.map(function(ele,index,arr){return ele.XPath+ele.width.toString()+ele.height.toString()+ele.visible.toString()+ele.x.toString()+ele.y.toString();}).sort().join("\n"),url:(document.URL.indexOf("?")==-1?document.URL:document.URL.substr(0,document.URL.indexOf("?")))});
		else return that.flattenedResults;			//for console debugging purposes.
	}
	
	this.getXPath = function(element) {
		var document = element.ownerDocument;
		if (element.id!=='' && typeof element.id != 'undefined')
			return "//"+element.tagName+"[@id='"+element.id+"']";
		if (element===document.body)
			return '/HTML/' + element.tagName;

		var ix = 0;
		if (typeof element.parentNode != 'undefined' && element.parentNode != null)
		{
			var siblings = element.parentNode.childNodes;
			for (var i= 0; i<siblings.length; i++) {
				var sibling= siblings[i];
				if (sibling===element)
					return that.getXPath(element.parentNode)+'/'+element.tagName+'['+(ix+1)+']';
				if (sibling.nodeType===1 && sibling.tagName===element.tagName)
					ix++;
			}
		}
	}
	
	this.init = function(){
	
		this.sortedAttrInfoMap = [];
		this.AttrInfoMap = [];
		this.userInfoFound = false;
		this.count = 0;
		this.hasTwitter = false;									
		this.hasLogin = false;								
		this.hasLikeOrShare = false;
		this.hasOtherIdP = false;
		this.rightEdge = this.getMargin();
	}
	
	this.init();
	
	return this;
}

var vulCheckerHelper = new VulCheckerHelper();

//**** Below is a possible configuration ****//
/*
y = 0;
function scroll(y)
//this function scrolls quickly down the document to trigger some potential event handlers. (msn.com)
{
	if (y >= document.body.offsetHeight) {
		window.scrollTo(0, document.body.offsetHeight);
		window.scrollTo(0, 0);
		return;
	}
	window.scrollTo(0,y);
	y += screen.availHeight;
	setTimeout(scroll.bind(window,y),10);
}

scroll(y);
*/
//**** Above is a possible configuration ****//

if (self.port)
{
	//press login button worker has two duties:
	//1: report all candidates under all configurations (upon request).
	//2: click a specific candidate given a strategy.
	//duty 1: report candidates
	self.port.on("reportCandidates", function (response){
		//need three things from response: current account, if we are looking for sign up for FB, and what's the current click attempt number
		vulCheckerHelper.account = response.account;
		vulCheckerHelper.searchForSignUpForTwitter = response.searchForSignUpForTwitter;
		vulCheckerHelper.loginClickAttempts = response.loginClickAttempts;
		vulCheckerHelper.maxCandidatesAllowedEachStrategy = response.maxCandidatesAllowedEachStrategy;
		vulCheckerHelper.reportCandidates();		//Just report the candidates, don't click on anything yet.
	});
	//duty 2: click candidate
	self.port.on("clickCandidate", function(response){
		//need 1 thing from response: which candidate (rank) are we clicking.
		vulCheckerHelper.flattenedResults[response.original_index].node.click();
		//vulCheckerHelper.clickedButtons.push(vulCheckerHelper.getXPath(vulCheckerHelper.flattenedResults[response.original_index].node));		//record the clicked button, so that we don't click the same button next time if the page doesn't nav away.
	});
}
else
{
	log(vulCheckerHelper.reportCandidates());
}