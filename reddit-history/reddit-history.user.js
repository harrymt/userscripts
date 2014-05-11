// ==UserScript==
// @name           Reddit History
// @namespace      tag:halbersa@gmail.com,2012-02-24:ahal
// @description    Keeps track of all the submissions you viewed on Reddit
// @include        https://www.reddit.com*
// @include        http://www.reddit.com*
// @exclude        http://www.reddit.com/user/*
// @exclude        http://www.reddit.com/*/comments/*
// @exclude        http://www.reddit.com/submit
// @exclude        http://www.reddit.com/reddits/create
// @exclude        http://www.reddit.com/account-activity
// ==/UserScript==

var header = document.getElementById('header');
var content = document.querySelectorAll('div.content')[0];
var user = header.querySelectorAll('span.user')[0].getElementsByTagName('a')[0].innerHTML;
var history = new History(user);

append_history_tab();
add_click_listeners();


/**
 * Appends a history tab to the navbar
 */
function append_history_tab() {
    "use strict"; // Better error catching fix, see caniuse.com/#use-strict
    var tabMenu = header.querySelectorAll('ul.tabmenu')[0];
    var listItem = document.createElement('li');
    var link = document.createElement('a');

    /**
     * Displays the history tab
     */
    var click_history = function () {
        var items = tabMenu.getElementsByTagName('li');

        var reload = function () {
            location.reload();
        };

        for (var i = 0; i < items.length; ++i) {
            if (items[i].className == "selected") {
                items[i].className = "";
                items[i].addEventListener('click', reload);
            }
        }
        listItem.className = "selected";

        // Build the chrome controls
        content.innerHTML = "";
        var h_controls = document.createElement('div');
        h_controls.className = 'spacer historyControls';

        var subs = history.get_subs();
        var keys = [];
        for (var k in subs) {
            if (subs.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        keys.sort(function (a, b) {
            if (a.toLowerCase() > b.toLowerCase())
                return 1;
            if (b.toLowerCase() > a.toLowerCase())
                return -1;
            return 0;
        });

        var s = "<select id='rhSubs'><option selected value=''>All Subreddits</option>";
        for (i = 0; i < keys.length; ++i) {
            s += "<option value='" + subs[keys[i]] + "'>" + keys[i] + "</option>";
        }

        s += "</select> <input id='rhRegex' value=''/>";
        s += "<button id='rhFilter'>Filter (regex)</button>";
        s += "<button id='rhClear'>Clear All History</button>";
        s += "<button id='rhExport'>Export History to csv</button>";
        s += "<div style='text-align: right; width: 50%; float: right;'>";
        s += "Limit<input id='rhLimit' value='0'/>";
        s += "<input type='button' id='rhIncrementor' value='+'><input type='button' id='rhDecrementor' value='-'>";
        s += "<button id='rhSave'>Save</button></div>";
        s += "<br><input type='checkbox' id='rhIgnoreCase' checked='" + GM_getValue('ignorecase', true) + "'/>ignore case";

        h_controls.innerHTML = s;
        content.appendChild(h_controls);

        var h_items = document.createElement('div');
        h_items.className = 'spacer historyItems';
        content.appendChild(h_items);

        // Add button listeners
        var h_filter = document.getElementById('rhFilter');
        var h_clear = document.getElementById('rhClear');
        var h_save = document.getElementById('rhSave');
        var h_case = document.getElementById('rhIgnoreCase');
        h_filter.addEventListener('click', filter);
        h_clear.addEventListener('click', clear);
        h_save.addEventListener('click', save_limit);
        h_case.addEventListener('click', function () {
            GM_setValue('ignorecase', h_case.checked);
        });

        // Add limit + and - button listeners
        var h_incrementor = document.getElementById('rhIncrementor');
        var h_decrementor = document.getElementById('rhDecrementor');
        h_incrementor.addEventListener('click', function () {
            change_limit(1, 'increment');
        });
        h_decrementor.addEventListener('click', function () {
            change_limit(1, 'decrement');
        });

        // Export all history
        var h_Export = document.getElementById('rhExport');
        h_Export.addEventListener('click', export_history);

        // Add select listener
        var h_subs = document.getElementById('rhSubs');
        h_subs.addEventListener('change', filter);

        var h_limit = document.getElementById('rhLimit');

        // TODO make this more efficient
        // If the value is 0 (start value), set it to default limit
        var defaultLimit = 10;
        var currentLimit = GM_getValue('limit', 10000);

        if (currentLimit < 0) {
            h_limit.value = parseInt(defaultLimit);
        } else {
            h_limit.value = currentLimit;
        }

        // Display the History after the tab click 
        save_limit();
    };

    link.innerHTML = "history";
    link.href = "#";
    link.addEventListener("click", click_history, false);
    listItem.appendChild(link);
    tabMenu.appendChild(listItem);
}

/*
 * Export all users Reddit history in csv format.
 *
 * TODO have different data ranges, date ranges.
 *
 */
function export_history() {

    // prepare CSV data
    var csvData = new Array();

    // Create csv headings
    csvData.push('"Post Title","Link","Subreddit","Date viewed","Domain"');

    // A messy way to get all history items
    // TODO use jquery  
    var history_items = document.getElementsByClassName('historyItems')[0].children;
    var history_item = null,
        h_title = null,
        h_link = null,
        h_subreddit = null,
        h_dateviewed = null,
        h_domain = null;

    var url = null;

    // Cycle through each history item
    for (var i = 0; i < history_items.length; i += 2) {

        /* MESSY TODO FIX */
        // Gets all of the history information to be stored 
        history_item = document.getElementsByClassName('historyItems')[0].children[i].children[2].children;

        // Get each item's attributes
        url = history_item[0].children[0];
        h_title = url.innerHTML;
        h_link = url.href;
        h_subreddit = history_item[1].children[0].href.substring(21, 100); // Bad way to be trimmed
        h_dateviewed = history_item[1].innerHTML.substring(17, 32); // Bad way to be trimmed
        h_domain = history_item[0].children[1].children[0].innerHTML; // Could get this from link

        console.log('--------------');
        console.log('TITLE : ' + h_title);
        console.log('LINK : ' + h_link);
        console.log('SUBREDDIT : ' + h_subreddit);
        console.log('DATEVIEWED : ' + h_dateviewed);
        console.log('DOMAIN : ' + h_domain);

        csvData.push('"' + h_title + '","' + h_link + '","' + h_subreddit + '","' + h_dateviewed + '","' + h_domain + '","' + '"');
    }

    // Prepare the download
    var buffer = csvData.join("\n");
    var uri = "data:text/csv;charset=utf8," + encodeURIComponent(buffer);

    // Download the csv file
    document.location = uri;
}


/*
 * Change the limit of history shown.
 *
 * Example usage.
 * // Decrement the limit by 2
 * change_limit(2, 'decrement')
 *
 * @param amount, integer stating the amount to change the limit by.
 * @param type, 'decrement' or 'increment', add to minus the amount.
 *
 * TODO If user puts in !int in box, NaN happens and fails. Fix this
 */
function change_limit(amount, type) {

    // Get current limit value 
    var counterVal = parseInt(document.getElementById('rhLimit').value);

    // If there is an error in the limit box, reset it back to 1
    if (counterVal === undefined || counterVal < 1) {
        counterVal = 1;
    }

    // Function error checking, normally wouldn't be a problem
    if (amount !== undefined && amount > 0) {

        console.log(type + " limit by " + amount);

        // If type is invalid, return
        if (type != 'increment' && type != 'decrement') {
            console.log('string passed in error. Usage change_limit(amount,\'increment\' or \'decrement\')');
            return;
        }

        // Increment or decrement based on input
        if (type == 'increment') {
            console.log('Incremented to ' + (counterVal + amount));
            // Increment
            document.getElementById('rhLimit').value = counterVal + amount;
        }

        if (type == 'decrement') {
            console.log('Decremented to ' + (counterVal - amount));

            var newLimit = parseInt(counterVal - amount);
            if (newLimit < 1) {
                newLimit = 1;
            }
            // Decrement
            document.getElementById('rhLimit').value = newLimit;
        }

        // Update the History shown.
        save_limit();

    } else {
        // Error in function 1st arg
        console.log('Amount passed in error. Usage change_limit(amount,\'increment\' or \'decrement\')');
    }
}



/**
 * Adds a listener to each submission
 */
function add_click_listeners() {
    var siteTable = document.getElementById('siteTable');
    var submissions = siteTable.querySelectorAll('div.entry');
    for (var i = 0; i < submissions.length; ++i) {
        add_handlers(submissions[i]); // needed to scope
    }
}


function add_handlers(s) {
    var link = s.querySelectorAll('a.title')[0];
    var comment = s.querySelectorAll('a.comments')[0];
    var expbtn = s.querySelectorAll('a.expando-button')[0];

    /**
     * Adds the submission to history
     */
    var add_submission = function () {
        var domain = s.querySelectorAll('span.domain')[0].getElementsByTagName('a')[0];
        var sub = s.querySelectorAll('p.tagline')[0].querySelectorAll('a.subreddit')[0];
        if (sub === undefined) {
            sub = header.querySelectorAll('span.redditname')[0].getElementsByTagName('a')[0];
        }
        history.add_submission(link.innerHTML,
            link.href,
            comment.href,
            sub.innerHTML,
            sub.href,
            domain.innerHTML,
            domain.href);
    };
    link.addEventListener('click', add_submission);
    comment.addEventListener('click', add_submission);
    if (expbtn !== undefined) {
        expbtn.addEventListener('click', add_submission);
    }
}

/**
 * Displays the history in the history tab
 */
function show_history(regex, sub) {
    var h_controls = content.querySelectorAll('div.historyControls')[0];
    var h_items = content.querySelectorAll('div.historyItems')[0];
    var re = null;
    if (regex !== undefined) {
        var modifiers = "";
        if (GM_getValue('ignorecase', true)) {
            modifiers = "i";
        }
        re = new RegExp(regex, modifiers);
        var filter = document.getElementById('rhRegex');
        filter.value = regex;
    }
    var items = history.get_history(re, sub);
    var subs = history.get_subs();

    for (var i = 0; i < items.length; ++i) {
        var mod = (i % 2 === 0 ? 'even' : 'odd');
        var div = document.createElement('div');
        div.className = "thing link " + mod;

        var s = "<span class='rank' style='width:3.30ex;'>" + (i + 1) + "</span>";
        s += "<div class='midcol' style='width:5ex;'><div class='arrow up'></div><div class='score unvoted'>•</div><div class='arrow down'></div></div>";
        s += "<div class='entry lcTagged' keyindex='" + i + "' style='margin-left:5px;'>";
        s += "<p class='title'><a class='title' href='" + items[i].url + "'>" + items[i].name + "</a>";
        s += "<span class='domain'> (<a href='" + items[i].domain_url + "'>" + items[i].domain_name + "</a>)</span></p>";
        s += "<p class='tagline'>last accessed on " + items[i].accessed + ", in <a href='" + subs[items[i].sub_name] + "'>" + items[i].sub_name + "</a></p>";
        s += "<ul class='flat-list buttons'><li class='first'><a class='comments' href='" + items[i].comments + "'>view comments</a></li>";
        s += "<li><a class='rhDelete' href='#'>delete</a></li></ul></div>";
        div.innerHTML = s;
        h_items.appendChild(div);

        var clear = document.createElement('div');
        clear.className = "clearleft";
        h_items.appendChild(clear);

        add_delete_listener(items[i], div);
    }
}

function add_delete_listener(s, div) {
    var h_delete = div.querySelectorAll('a.rhDelete')[0];
    h_delete.addEventListener('click', function () {
        var h_items = content.querySelectorAll('div.historyItems')[0];
        history.remove_submission(s.comments);
        h_items.removeChild(div);
    });
}

/**
 * Filter the displayed history
 */
function filter() {
    var h_items = content.querySelectorAll('div.historyItems')[0];
    var h_regex = document.getElementById('rhRegex');
    var h_subs = document.getElementById('rhSubs');
    h_items.innerHTML = "";
    show_history(h_regex.value, h_subs.options[h_subs.selectedIndex].innerHTML);
}

/**
 * Clear all history
 */
function clear() {
    if (confirm("Are you sure you want to permanently delete all history?")) {
        history.clear();
        var h_items = content.querySelectorAll('div.historyItems')[0];
        h_items.innerHTML = "";
    }
}

/**
 * Modify the maximum number of submissions stored
 */
function save_limit() {
    var h_limit = document.getElementById('rhLimit');
    var re = new RegExp("^([1-9]|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9]|[1-9][0-9][0-9][0-9][0-9])$"); // 1...99999
    if (re.test(h_limit.value)) {
        GM_setValue('limit', parseInt(h_limit.value) - 1);
        filter();
    } else {
        //alert("Enter a number from 1 to 99999");

    }
}

/**
 * Wrapper around the localStorage object
 * Used to manipulate all operations related to history
 */
function History(user) {
    this.key = "reddit_history_" + user;
    this.subs = this.key + "_subs";

    var items = localStorage.getItem(this.key);
    if (items === null) {
        items = [];
        localStorage.setItem(this.key, JSON.stringify(items));
    } else {
        items = JSON.parse(items);
    }

    // Maintain backwards compatibility with older versions of the script
    var subs = localStorage.getItem(this.subs);
    if (subs === null) {
        subs = {};
        for (var i = 0; i < items.length; ++i) {
            if ("sub_name" in items[i] && "sub_url" in items[i]) {
                subs[items[i].sub_name] = items[i].sub_url;
            }
        }
        localStorage.setItem(this.subs, JSON.stringify(subs));
    }
}

History.prototype.get_history = function (regex, sub) {
    limit = GM_getValue('limit', 10000);
    var submissions = JSON.parse(localStorage[this.key]);
    var count = 0;
    var ret = [];
    while (submissions.length > 0 && count <= limit) {
        var s = submissions.pop();
        if ((regex === null || regex.test(s.name)) && (sub === null || sub == "All Subreddits" || s.sub_name == sub)) {
            ret.push(s);
            count++;
        }
    }
    return ret;
};

History.prototype.indexOf = function (s) {
    var submissions = JSON.parse(localStorage.getItem(this.key));
    var t;
    for (var i = 0; i < submissions.length; ++i) {
        t = submissions[i];
        if (t.comments == s.comments) {
            return i;
        }
    }
    return -1;
};

History.prototype.add_submission = function (name, url, comments, sub_name, sub_url, domain_name, domain_url) {
    console.log('You clicked on a submission from ' + name);
    var s = {
        'name': name,
        'url': url,
        'comments': comments,
        'sub_name': sub_name,
        'domain_name': domain_name,
        'domain_url': domain_url,
        'accessed': new Date()
            .toDateString()
    };

    var subs = JSON.parse(localStorage.getItem(this.subs));
    subs[sub_name] = sub_url;
    localStorage.setItem(this.subs, JSON.stringify(subs));

    var submissions = JSON.parse(localStorage.getItem(this.key));
    var index = this.indexOf(s);
    if (index != -1) {
        submissions.splice(index, 1);
    }
    submissions.push(s);
    if (submissions.length > GM_getValue('limit', 10000)) {
        submissions.shift();
    }
    localStorage.setItem(this.key, JSON.stringify(submissions));
};

History.prototype.remove_submission = function (comments) {
    // The comment url uniquely identifies the submission
    var s = {
        'comments': comments
    };
    var index = this.indexOf(s);
    if (index != -1) {
        // Remove submission
        var submissions = JSON.parse(localStorage.getItem(this.key));
        var sub_name = submissions[index].sub_name;
        submissions.splice(index, 1);
        localStorage.setItem(this.key, JSON.stringify(submissions));

        // Remove subreddit entry 
        for (var i = 0; i < submissions.length; ++i) {
            if (submissions[i].sub_name == sub_name) {
                return;
            }
        }
        var subs = JSON.parse(localStorage.getItem(this.subs));
        delete subs[sub_name];
        localStorage.setItem(this.subs, JSON.stringify(subs));
    }
};

History.prototype.get_subs = function () {
    return JSON.parse(localStorage.getItem(this.subs));
};

History.prototype.clear = function () {
    localStorage.setItem(this.key, JSON.stringify([]));
    localStorage.setItem(this.subs, JSON.stringify({}));
};