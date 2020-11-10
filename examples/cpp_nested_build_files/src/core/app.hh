#ifndef APP_HH
#define APP_HH

#include <iostream>

#include "app_state.hh"

class App {
    public:
        static App *get_instance();

        AppState *get_state();
    private:
        App();
        ~App();

        static App *_instance;

        AppState *_state;
};

#endif