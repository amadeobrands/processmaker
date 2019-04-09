import "bootstrap-vue/dist/bootstrap-vue.css";
import BootstrapVue from "bootstrap-vue";
import Echo from "laravel-echo";
import VueRouter from "vue-router";
import datetime_format from "../js/data/datetime_formats.json"



window._ = require("lodash");
window.Popper = require("popper.js").default;

/**
 * We'll load jQuery and the Bootstrap jQuery plugin which provides support
 * for JavaScript based Bootstrap features such as modals and tabs. This
 * code may be modified to fit the specific needs of your application.
 */

window.$ = window.jQuery = require("jquery");

require("bootstrap");

/**
 * Vue is a modern JavaScript library for building interactive web interfaces
 * using reactive data binding and reusable components. Vue's API is clean
 * and simple, leaving you to focus on building your next great project.
 */

window.Vue = require("vue");

window.Vue.use(BootstrapVue);
window.Vue.use(VueRouter);

window.ProcessMaker = {
    /**
     * A general use global event bus that can be used
     */
    EventBus: new Vue(),
    /**
     * ProcessMaker Notifications
     */
    notifications: [],
    /**
     * Push a notification.
     *
     * @param {object} notification
     *
     * @returns {void}
     */
    pushNotification(notification) {
        if (this.notifications.filter(x => x.id === notification).length === 0) {
            this.notifications.push(notification);
        }
    },

    /**
     * Removes notifications by message ids or urls
     *
     * @returns {void}
     * @param messageIds
     *
     * @param urls
     */
    removeNotifications(messageIds = [], urls = []) {
        return window.ProcessMaker.apiClient.put('/read_notifications', { message_ids: messageIds, routes: urls }).then(() => {
            messageIds.forEach(function (messageId) {
                ProcessMaker.notifications.splice(ProcessMaker.notifications.findIndex(x => x.id === messageId), 1);
            });

            urls.forEach(function (url) {
                let messageIndex = ProcessMaker.notifications.findIndex(x => x.url === url);
                if (messageIndex >= 0) {
                    ProcessMaker.removeNotification(ProcessMaker.notifications[messageIndex].id);
                }
            });
        });
    },
    /**
     * Mark as unread a list of notifications
     *
     * @returns {void}
     * @param messageIds
     *
     * @param urls
     */
    unreadNotifications(messageIds = [], urls = []) {
        return window.ProcessMaker.apiClient.put('/unread_notifications', { message_ids: messageIds, routes: urls });
    },
};

/**
 * Create a axios instance which any vue component can bring in to call
 * REST api endpoints through oauth authentication
 *
 */
window.ProcessMaker.apiClient = require("axios");

window.ProcessMaker.apiClient.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";

/**
 * Next we will register the CSRF Token as a common header with Axios so that
 * all outgoing HTTP requests automatically have it attached. This is just
 * a simple convenience so we don't have to attach every token manually.
 */

let token = document.head.querySelector("meta[name=\"csrf-token\"]");

if (token) {
    window.ProcessMaker.apiClient.defaults.headers.common["X-CSRF-TOKEN"] = token.content;
} else {
    console.error("CSRF token not found: https://laravel.com/docs/csrf#csrf-x-csrf-token");
}

window.ProcessMaker.apiClient.defaults.baseURL = "/api/1.0/";
// Default to a 5 second timeout, which is an eternity in web app terms
window.ProcessMaker.apiClient.defaults.timeout = 5000;

// Default alert functionality
window.ProcessMaker.alert = function (text, variant) {
    window.alert(`${variant}: ${text}`);
};

let userID = document.head.querySelector("meta[name=\"user-id\"]");
let formatDate = document.head.querySelector("meta[name=\"datetime-format\"]");
let timezone = document.head.querySelector("meta[name=\"timezone\"]");

if (userID) {
    window.ProcessMaker.user = {
        id: userID.content,
        datetime_format: formatDate.content,
        calendar_format: formatDate.content,
        timezone: timezone.content
    };
    datetime_format.forEach(value => {
        if (formatDate.content === value.format) {
            window.ProcessMaker.user.datetime_format = value.momentFormat;
            window.ProcessMaker.user.calendar_format = value.calendarFormat;
        }
    });
}

let broadcaster = document.head.querySelector("meta[name=\"broadcaster\"]");
let key = document.head.querySelector("meta[name=\"broadcasting-key\"]");
let host = document.head.querySelector("meta[name=\"broadcasting-host\"]");

window.Echo = new Echo({
    broadcaster: broadcaster.content,
    key: key.content,
    host: host.content
});

if (userID) {
    // Session timeout
    let timeoutScript = document.head.querySelector("meta[name=\"timeout-worker\"]").content;
    window.ProcessMaker.AccountTimeoutLength = parseInt(document.head.querySelector("meta[name=\"timeout-length\"]").content);

    window.ProcessMaker.AccountTimeoutWorker = new Worker(timeoutScript);
    window.ProcessMaker.AccountTimeoutWorker.addEventListener('message', function (e) {
        if (e.data.method === 'timedOut') {
            window.ProcessMaker.sessionModal('Session Warning', 'Your user session is expiring. If your session expires, all of your unsaved data will be lost. <br> <br> Would you like to keep it active?');
        }
    });

    window.ProcessMaker.AccountTimeoutWorker.postMessage({ method: 'start', data: { timeout: window.ProcessMaker.AccountTimeoutLength } });

    window.Echo.private(`ProcessMaker.Models.User.${userID.content}`)
        .notification((token) => {
            ProcessMaker.pushNotification(token);
        })
        .listen('.SessionStarted', (e) => {
            let lifetime = parseInt(e.lifetime);
            window.ProcessMaker.AccountTimeoutWorker.postMessage({ method: 'start', data: { timeout: lifetime } });
            window.ProcessMaker.closeSessionModal();
        });
}