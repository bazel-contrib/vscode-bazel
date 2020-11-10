#include "app.hh"

App* App::_instance = nullptr;

App::App()
{
    this->_state = new AppState();
}

App::~App()
{
    delete this->_state;
}
