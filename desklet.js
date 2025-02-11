const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;
const Desklet = imports.ui.desklet;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;

const API_BASE_URL = "https://api.aladhan.com/v1/timingsByCity";
const CITY = "Budapest";
const COUNTRY = "Hungary";
const METHOD = "2";  // Calculation method
const UPDATE_INTERVAL = 600;  // Update interval in seconds

function PrayerTimesDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

PrayerTimesDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

        // Initialize Soup session
        this._httpSession = new Soup.Session();
        global.log("[PrayerTimesDesklet] Soup session initialized");

        // Create a container for the desklet
        this._container = new St.BoxLayout({ vertical: true, style_class: 'prayer-times-container' });
        this.setContent(this._container);
        global.log("[PrayerTimesDesklet] Container created");

        this._timeLabel = new St.Label({
            text: this._getCurrentTime(),
            style_class: 'prayer-times-time'
        });
        this._container.add(this._timeLabel);

        // Start updating the current time every second
        this._updateCurrentTime();


        // Create a box for prayer times
        this._prayerTimesBox = new St.BoxLayout({
            vertical: true,
            style_class: 'prayer-times-box'
        });
        this._container.add(this._prayerTimesBox);

        // Fetch and display prayer times
        this._updatePrayerTimes();

        this._scheduleMidnightUpdate();
    },

    _getCurrentTime: function() {
        // Get the current time in HH:MM:SS format
        let now = new Date();
        let hours = String(now.getHours()).padStart(2, '0');
        let minutes = String(now.getMinutes()).padStart(2, '0');
        let seconds = String(now.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}`;
    },

    _updateCurrentTime: function() {
        // Update the time label every second
        this._timeLabel.set_text(this._getCurrentTime());
        Mainloop.timeout_add_seconds(59, () => {
            this._updateCurrentTime();
            return false;  // Continue updating
        });
    },

    _updatePrayerTimes: function() {
        global.log("[PrayerTimesDesklet] Updating prayer times");

        // Get today's date in DD-MM-YYYY format
        let today = new Date();
        let day = String(today.getDate()).padStart(2, '0');
        let month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        let year = today.getFullYear();
        let dateStr = `${day}-${month}-${year}`;

        // Construct the API URL
        let url = `${API_BASE_URL}/${dateStr}?city=${CITY}&country=${COUNTRY}&method=${METHOD}`;
        global.log(`[PrayerTimesDesklet] API URL: ${url}`);

        // Create a GET request
        let message = Soup.Message.new('GET', url);

        // Send the request asynchronously
        this._httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, (session, result) => {
            try {
                let response = this._httpSession.send_and_read_finish(result);
                if (message.status_code === 200) {
                    global.log("[PrayerTimesDesklet] API request successful");

                    // Convert the byte array to a string using TextDecoder
                    let decoder = new TextDecoder('utf-8');
                    let responseBody = decoder.decode(response.get_data());
                    global.log(`[PrayerTimesDesklet] API response: ${responseBody}`);

                    // Parse the JSON data
                    let data = JSON.parse(responseBody);
                    if (data && data.data && data.data.timings) {
                        this._displayPrayerTimes(data.data.timings);
                    } else {
                        throw new Error("Invalid API response format");
                    }
                } else {
                    throw new Error(`API request failed: ${message.status_code}`);
                }
            } catch (error) {
                global.log(`[PrayerTimesDesklet] Error: ${error.message}`);
                this._prayerTimesBox.remove_all_children();
                this._prayerTimesBox.add(new St.Label({ text: 'Failed to fetch prayer times', style_class: 'prayer-times-error' }));
            }

            // Schedule the next update
            // Mainloop.timeout_add_seconds(UPDATE_INTERVAL, () => {
            //     this._updatePrayerTimes();
            //     return false;
            // });
        });
    },

    _displayPrayerTimes: function(timings) {
        this._prayerTimesBox.remove_all_children();

        // Define the order of prayers to display
        const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

        // Display the prayer times in a vertical list
        prayers.forEach(prayer => {
            let prayerBox = new St.BoxLayout({
                vertical: false,
                style_class: 'prayer-time-box'
            });

            let prayerLabel = new St.Label({
                text: `${prayer}:`,
                style_class: 'prayer-time-label'
            });

            let timeLabel = new St.Label({
                text: timings[prayer],
                style_class: 'prayer-time-value'
            });

            prayerBox.add(prayerLabel);
            prayerBox.add(timeLabel);
            this._prayerTimesBox.add(prayerBox);
        });

        global.log("[PrayerTimesDesklet] Displayed prayer times");
    },

    _scheduleMidnightUpdate: function() {
        // Calculate the time remaining until midnight
        let now = new Date();
        let midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);  // Set to next midnight
        let timeUntilMidnight = midnight - now;  // Time in milliseconds

        // Schedule the update at midnight
        Mainloop.timeout_add(timeUntilMidnight / 1000, () => {
            this._updatePrayerTimes();  // Update prayer times
            this._scheduleMidnightUpdate();  // Schedule the next midnight update
            return false;  // Don't repeat
        });

        global.log(`[PrayerTimesDesklet] Next update scheduled at midnight`);
    },

    on_desklet_removed: function() {
        Mainloop.source_remove(this._timeout);
    }
};

function main(metadata, desklet_id) {
    return new PrayerTimesDesklet(metadata, desklet_id);
}
