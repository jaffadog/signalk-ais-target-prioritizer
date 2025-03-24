/*
 * signalk-ais-target-prioritizer
 */

//import fields from "react-jsonschema-form-extras"

module.exports = function(app) {
    var plugin = {};
    var unsubscribes = [];

    plugin.id = "signalk-ais-target-prioritizer";
    plugin.name = "SignalK AIS Target Prioritizer";
    plugin.description = "A SignalK plugin that priorizes AIS targets according to guard and CPA criteria";

    plugin.start = function(options) {
        app.debug('Plugin started');

        //gpsSource = options.gpsSource;
        //trackInterval = options.trackInterval;

        var localSubscription = {
            context: 'vessels.self',
            subscribe: [{
                path: 'navigation.position',
                period: 10 * 60 * 1000
            }]
        };

        app.subscriptionmanager.subscribe(
            localSubscription,
            unsubscribes,
            subscriptionError => {
                app.error('Error:' + subscriptionError);
            },
            delta => processDelta(delta)
        );
    };

    plugin.stop = function() {
        app.debug(`Stopping the plugin`);
        unsubscribes.forEach(f => f());
        unsubscribes = [];
    };

    plugin.schema = {
        properties: {

            activeProfile: {
                type: 'object',
                title: 'Active Profile',
                properties: {
                    profile: {
                        type: 'string',
                        title: 'Profile',
                        description: 'Select the active profile. See Warning, Danger, and Guard thresholdss for each profile below. (default is harbor)',
                        enum: [
                          'anchor',
                          'harbor',
                          'coastal',
                          'offshore'
                        ],
                        default: 'harbor'
                    },
                }
            },
            
            anchorProfile: {
                type: 'object',
                title: 'Anchor Profile',
                description: 'Configure the Warning, Danger, and Guard thresholds for the *Anchor* profile below',
                properties: {

                    warning: {
                        type: 'object',
                        title: 'Warning',
                        required: ['cpa','tcpa','range','speed'],
                        properties: {
                            cpa: {
                                title: 'CPA',
                                description: 'Closest point of approach in NM (default 0 / disabled)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                multipleOf: 0.5,
                                default: 0
                            },
                            tcpa: {
                                title: 'TCPA',
                                description: 'Time to CPA in minutes (default 60)',
                                type: 'number',
                                minimum: 0,
                                maximum: 60,
                                default: 60
                            },
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 48)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 48
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                multipleOf: 0.1,
                                default: 0
                            }
                        }
                    },

                    danger: {
                        type: 'object',
                        title: 'Danger',
                        required: ['cpa','tcpa','range','speed'],
                        properties: {
                            cpa: {
                                title: 'CPA',
                                description: 'Closest point of approach in NM (default 0 / disabled)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 0
                            },
                            tcpa: {
                                title: 'TCPA',
                                description: 'Time to CPA in minutes (default 60)',
                                type: 'number',
                                minimum: 0,
                                maximum: 60,
                                default: 60
                            },
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 48)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 48
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 0
                            }
                        }
                    },

                    guard: {
                        type: 'object',
                        title: 'Guard',
                        required: ['range','speed'],
                        properties: {
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 0 / disabled)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 0
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 0
                            }
                        }
                    }
                }
            }, // end anchorProfile
                
            harborProfile: {
                type: 'object',
                title: 'Harbor Profile',
                description: 'Configure the Warning, Danger, and Guard thresholds for the *Harbor* profile below',
                properties: {

                    warning: {
                        type: 'object',
                        title: 'Warning',
                        required: ['cpa','tcpa','range','speed'],
                        properties: {
                            cpa: {
                                title: 'CPA',
                                description: 'Closest point of approach in NM (default 0.5)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                multipleOf: 0.5,
                                default: 0.5
                            },
                            tcpa: {
                                title: 'TCPA',
                                description: 'Time to CPA in minutes (default 10)',
                                type: 'number',
                                minimum: 0,
                                maximum: 60,
                                default: 10
                            },
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 48)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 48
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0.5)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                multipleOf: 0.1,
                                default: 0.5
                            }
                        }
                    },

                    danger: {
                        type: 'object',
                        title: 'Danger',
                        required: ['cpa','tcpa','range','speed'],
                        properties: {
                            cpa: {
                                title: 'CPA',
                                description: 'Closest point of approach in NM (default 0.1)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 0.1
                            },
                            tcpa: {
                                title: 'TCPA',
                                description: 'Time to CPA in minutes (default 5)',
                                type: 'number',
                                minimum: 0,
                                maximum: 60,
                                default: 5
                            },
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 48)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 48
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 3)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 3
                            }
                        }
                    },

                    guard: {
                        type: 'object',
                        title: 'Guard',
                        required: ['range','speed'],
                        properties: {
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 0 / disabled)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 0
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 0
                            }
                        }
                    }
                }
            }, // end harborProfile

            coastalProfile: {
                type: 'object',
                title: 'Coastal Profile',
                description: 'Configure the Warning, Danger, and Guard thresholds for the *Coastal* profile below',
                properties: {

                    warning: {
                        type: 'object',
                        title: 'Warning',
                        required: ['cpa','tcpa','range','speed'],
                        properties: {
                            cpa: {
                                title: 'CPA',
                                description: 'Closest point of approach in NM (default 2)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                multipleOf: 0.5,
                                default: 2
                            },
                            tcpa: {
                                title: 'TCPA',
                                description: 'Time to CPA in minutes (default 30)',
                                type: 'number',
                                minimum: 0,
                                maximum: 60,
                                default: 30
                            },
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 48)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 48
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                multipleOf: 0.1,
                                default: 0
                            }
                        }
                    },

                    danger: {
                        type: 'object',
                        title: 'Danger',
                        required: ['cpa','tcpa','range','speed'],
                        properties: {
                            cpa: {
                                title: 'CPA',
                                description: 'Closest point of approach in NM (default 1)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 1
                            },
                            tcpa: {
                                title: 'TCPA',
                                description: 'Time to CPA in minutes (default 7.5)',
                                type: 'number',
                                minimum: 0,
                                maximum: 60,
                                default: 7.5
                            },
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 48)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 48
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0.5)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 0.5
                            }
                        }
                    },

                    guard: {
                        type: 'object',
                        title: 'Guard',
                        required: ['range','speed'],
                        properties: {
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 0 / disabled)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 0
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 0
                            }
                        }
                    }
                }
            }, // end coastalProfile

            offshoreProfile: {
                type: 'object',
                title: 'Offshore Profile',
                description: 'Configure the Warning, Danger, and Guard thresholds for the *Offshore* profile below',
                properties: {

                    warning: {
                        type: 'object',
                        title: 'Warning',
                        required: ['cpa','tcpa','range','speed'],
                        properties: {
                            cpa: {
                                title: 'CPA',
                                description: 'Closest point of approach in NM (default 4)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                multipleOf: 0.5,
                                default: 4
                            },
                            tcpa: {
                                title: 'TCPA',
                                description: 'Time to CPA in minutes (default 30)',
                                type: 'number',
                                minimum: 0,
                                maximum: 60,
                                default: 30
                            },
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 48)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 48
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                multipleOf: 0.1,
                                default: 0
                            }
                        }
                    },

                    danger: {
                        type: 'object',
                        title: 'Danger',
                        required: ['cpa','tcpa','range','speed'],
                        properties: {
                            cpa: {
                                title: 'CPA',
                                description: 'Closest point of approach in NM (default 2)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 2
                            },
                            tcpa: {
                                title: 'TCPA',
                                description: 'Time to CPA in minutes (default 15)',
                                type: 'number',
                                minimum: 0,
                                maximum: 60,
                                default: 15
                            },
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 48)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 48
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 0
                            }
                        }
                    },

                    guard: {
                        type: 'object',
                        title: 'Guard',
                        required: ['range','speed'],
                        properties: {
                            range: {
                                title: 'Range',
                                description: 'Minimum target range in NM (default 0 / disabled)',
                                type: 'number',
                                minimum: 0,
                                maximum: 48,
                                default: 0
                            },
                            speed: {
                                title: 'Speed',
                                description: 'Minimum target speed in kt (default 0)',
                                type: 'number',
                                minimum: 0,
                                maximum: 10,
                                default: 0
                            }
                        }
                    }
                }
            }, // end offshoreProfile

        }
    };

    /*
    plugin.uiSchema = {

        foo: {
            'ui:classNames': 'card',
            bar: {
                'ui:classNames': 'card',
                'ui:widget': 'checkbox',
                //'ui:title': ' ',
                //'ui:help': ''
            }
        },
        
        activeProfile: {
            'ui:classNames': 'card',
            profile: {
                'ui:widget': 'radio',
                //'ui:title': 'Course calculation method',
                //'ui:help': ' '
            }
        },

        XXXactiveProfile: {
            'ui:widget': 'radio',
            //'ui:title': 'my active profile',
            //'ui:help': ' '
        },

        XXactiveProfile: {
            "ui:field": "collapsible",
            collapse: {
              field: "StringField",
              legend: {
                component: "LanguageLegend",
                props: {
                  language: "EN"
                }
              }
            }
        },

        anchorProfile: {
            'ui:classNames': 'card'
        },
        
        anchorProfile3: {
            'ui:field': 'collapsible',
            collapse: {
              field: 'ObjectField',
              wrapClassName: 'panel-group'
            }
        },

        anchorProfile4: {
            warning: {
                cpa: {
                    'ui:widget': 'range'
                },
                tcpa: {
                    'ui:widget': 'range'
                },
                range: {
                    'ui:widget': 'range'
                },
                speed: {
                    'ui:widget': 'range'
                },
            }
        },
        
        "anchorProfile2": {
               "ui:field": "collapsible",
               "collapse": {
                   "field": "ObjectField",
                   "wrapClassName": "panel-group"
               }
        },

        
          
        
    };*/


    
    // FIXME: make a simple webapp to expose buttons to trigger the actions below. or can we put buttons on the plugin config screen?
    plugin.registerWithRouter = (router) => {
        // http://raspberrypi.local/plugins/signalk-daily-gpx-plugin/write-gpx-file-now
        router.get('/write-gpx-file-now', (req, res) => {
            writeDailyGpxFile().then(
                ok => {
                    res.send(`Saved ${filename}`);
                },
                err => {
                    res.send(`Error ${err}`);
                }
            );
        });
        // http://raspberrypi.local/plugins/signalk-daily-gpx-plugin/clear-buffer-now
        router.get('/clear-buffer-now', (req, res) => {
            clearBuffer();
            res.send(`buffer cleared at ${new Date().toISOString()}`);
        });
    };

    function updatePluginStatus() {
        app.debug('updating server status message');
        //app.setPluginStatus(message);
    };

    async function processDelta(delta) {

        // sample delta:
        // delta { context: 'vessels.urn:mrn:imo:mmsi:368204530', updates: [ { source: [Object], '$source': 'vesper.GP', timestamp: '2025-03-17T03:03:18.000Z', values: [Array] } ] }

        var update = delta.updates[0];
        
        app.debug('delta',delta);

    };


    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2 - lat1);  // deg2rad below
        var dLon = deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
            ;
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        return d;
    };

    function deg2rad(deg) {
        return deg * (Math.PI / 180)
    };

    return plugin;
};
