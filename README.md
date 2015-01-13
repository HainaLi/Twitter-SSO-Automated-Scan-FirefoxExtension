# Twitter-SSO-Automated-Scan-FirefoxExtension
Firefox Extension that automatically scans an input list of websites, searching for the Twitter SSO button, logging in, and finding vulnerabilities. 

A vulnerability checker application that scans for implementation faults with Twitter SSO.

Note: Firefox needs to have popup blocking turned off (go to options to diable that) and also caching turned off (got to about:config and type network.http.use-cache to disable it). Also turn off auto crash report submit by going to about:config and set toolkit.startup.max_resumed_crashes to -1.

Turn off Flash plugin if using addon SDK 1.16

modify addon-SDK-x.xx/python-lib/cuddlefish/prefs.py, find line 'javascript.options.strict': True

and set it to False.

Set devtools.chrome.enabled: true devtools.debugger.remote-enabled: true to enable debugging.

This application only works for Firefox's SDK version 1.16. You may experience unexpected problems if using a newer or older version of Firefox.



-----------------------------------------------------

Credits: Yuchen Zhou, a graduate student at UVA, has guided me through this project. Most of my code and ideas are modeled after his Facebook SSO. A user-friendly application of his project can be found http://ssoscan.org/

For more information about him or his work, visit: http://chromium.cs.virginia.edu/ or https://github.com/Treeeater/
